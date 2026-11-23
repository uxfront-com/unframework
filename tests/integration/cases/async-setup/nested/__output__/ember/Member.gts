import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { isDestroying, registerDestructor } from "@ember/destroyable";
import { renderSettled } from "@ember/renderer";
import { loadUser } from "./api";

export interface MemberSignature {
  Args: { id: string } & { ref?: (exposed: Pick<Member, "reset"> | null) => void } & {
    style?: unknown;
  };
  Element: HTMLElementTagNameMap["article"];
}

export default class Member extends Component<MemberSignature> {
  reset = () => {
    this.visits = 0;
  };

  initialUser = () => loadUser(this.args.id);

  user!: Awaited<ReturnType<typeof this.initialUser>>;

  initialVisits = () => this.user.visits;

  @tracked visits!: ReturnType<typeof this.initialVisits>;

  readonly asyncSetup = new AsyncSetup(this, async () => {
    this.user = await this.initialUser();
    if (isDestroying(this)) return;
    this.visits = this.initialVisits();
  });

  #mounted = false;

  /** Called at the template's end: the hooks run once the component has rendered. */
  onMounted = (): undefined => {
    if (!this.#mounted) {
      this.#mounted = true;
      afterRender(this, () => {
        this.args.ref?.({ reset: this.reset });
        registerDestructor(this, () => this.args.ref?.(null));
      });
    }
    return undefined;
  };

  listener1 = () => this.visits++;

  <template>{{#if this.asyncSetup.resolved}}<article
      class="member"
      style={{fallthroughStyle @style}}
      ...attributes
    ><h3>{{this.user.name}}</h3><button
      type="button"
      {{on "click" this.listener1}}
    >{{this.user.name}} visits: {{this.visits}}</button></article>{{(this.onMounted)}}{{/if}}</template>
}

/**
 * A component's async setup (Vue's `async setup` under `<Suspense>`): it runs as the
 * component is constructed, and `resolved` holds once it has, which the template waits for.
 * A component destroyed while it waits runs no more of it.
 */
class AsyncSetup {
  @tracked resolved = false;

  constructor(owner: object, run: () => Promise<void>) {
    void run().then(() => {
      if (!isDestroying(owner)) this.resolved = true;
    });
  }
}

/** Runs `run` once the render settles, unless its component is gone by then. */
function afterRender(owner: object, run: () => unknown): void {
  // A component on the server never mounts, as Vue registers no hook in a server render.
  if (import.meta.env.SSR) return;
  void renderSettled().then(() => {
    if (!isDestroying(owner)) void run();
  });
}

/**
 * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
 * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
 * A style is text, or a list of `[property, value]` declarations, where one without a property
 * is a whole style.
 */
function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
  const merged = new Map<string, unknown>();
  const add = (style: unknown): void => {
    if (style === undefined || style === null) return;
    if (Array.isArray(style)) {
      for (const [property, value] of style as [string, unknown][]) {
        if (property) merged.set(property, value);
        else add(value);
      }
    } else if (typeof style === "object" && !isHTMLSafe(style)) {
      for (const [key, value] of Object.entries(style)) {
        merged.set(
          key.startsWith("--")
            ? key
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          value,
        );
      }
    } else {
      const text = String(style).replace(/\/\*[^]*?\*\//g, "");
      for (const declaration of text.split(/;(?![^(]*\))/)) {
        const [property, value] = declaration.split(/:([^]+)/);
        if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
      }
    }
  };
  for (const style of styles) add(style);
  const text = Array.from(merged)
    .flatMap(([property, value]) =>
      value === undefined || value === null ? [] : [`${property}: ${String(value)}`],
    )
    .join("; ");
  return text ? htmlSafe(text) : undefined;
}
