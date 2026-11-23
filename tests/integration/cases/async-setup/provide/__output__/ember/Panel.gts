import Component from "@glimmer/component";
import { cached, tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { isDestroying } from "@ember/destroyable";
import Badge, { ToneKey } from "./Badge.gts";
import { loadUser } from "./api";

export interface PanelSignature {
  Args: { id: string } & { style?: unknown };
  Blocks: { default: [] };
  Element: HTMLElementTagNameMap["section"];
}

export default class Panel extends Component<PanelSignature> {
  initialUser = () => loadUser(this.args.id);

  user!: Awaited<ReturnType<typeof this.initialUser>>;

  readonly asyncSetup = new AsyncSetup(this, async () => {
    this.user = await this.initialUser();
    if (isDestroying(this)) return;
  });

  @cached
  get providerMarker(): Text {
    return provider([[ToneKey, "calm"]]);
  }

  <template>{{#if this.asyncSetup.resolved}}<section
      class="panel"
      aria-label={{this.user.name}}
      style={{fallthroughStyle @style}}
      ...attributes
    >{{this.providerMarker}}<Badge />{{yield}}</section>{{/if}}</template>
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

/**
 * Vue's `provide`: a text node, first in the component's root, that holds each provided value
 * under its key. The root's descendants find it, and no sibling of the root does (`inject`).
 */
function provider(entries: readonly (readonly [symbol, unknown])[]): Text {
  const marker = document.createTextNode("");
  for (const [key, value] of entries) Reflect.set(marker, key, value);
  return marker;
}
