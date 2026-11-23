import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { isDestroying, registerDestructor } from "@ember/destroyable";
import { renderSettled } from "@ember/renderer";

export interface Member {
  id: number;
  name: string;
}

export interface Inviter {
  name: string;
}

interface Draft {
  email?: string;
  tags: string[] | null;
}

export interface TeamInviteProps {
  inviter?: Inviter;
  members: Member[];
}

export interface TeamInviteEvents {
  onSelect?: (member: Member) => void;
  onRemoved?: (name: string) => void;
  onSubmitted?: (email: string) => void;
  onTagged?: (count: number) => void;
  onMoved?: (page: number) => void;
}

export interface TeamInviteSignature {
  Args: TeamInviteProps & { style?: unknown } & TeamInviteEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class TeamInvite extends Component<TeamInviteSignature> {
  pick = (member: Member) => {
    this.selected = member;
  };

  invite = () => {
    if (this.selected) this.args.onSelect?.(this.selected);
  };

  remove = () => {
    if (!this.selected) return;
    const member = this.selected;
    this.selected = null;
    this.args.onRemoved?.(member.name);
  };

  submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!this.draft.email) return;
    this.args.onSubmitted?.(this.draft.email);
  };

  tag = () => {
    if (this.draft.tags) {
      this.draft = { ...this.draft, tags: [...this.draft.tags, "team"] };
    } else {
      this.draft = { ...this.draft, tags: ["team"] };
    }
    if (this.draft.tags) this.args.onTagged?.(this.draft.tags.length);
  };

  start = () => {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.seconds += 1;
    }, 1000);
  };

  stop = () => {
    clearInterval(this.timer);
    this.timer = undefined;
  };

  get greeting() {
    return this.args.inviter ? `Invite as ${this.args.inviter.name}` : "Invite as a guest";
  }

  @tracked selected: Member | null = null;

  @tracked draft: Draft = { tags: null };

  @tracked page = 1;

  get pageCount() {
    return Math.ceil(this.args.members.length / 2);
  }

  get visible() {
    return this.args.members.slice((this.page - 1) * 2, this.page * 2);
  }

  @tracked byPassword = true;

  @tracked seconds = 0;

  @tracked timer: ReturnType<typeof setInterval> | undefined = undefined;

  #mounted = false;

  /** Called at the template's end: the hooks run once the component has rendered. */
  onMounted = (): undefined => {
    if (!this.#mounted) {
      this.#mounted = true;
      afterRender(this, () =>
        registerDestructor(this, () => {
          clearInterval(this.timer);
        }),
      );
    }
    return undefined;
  };

  value1 = (member: NonNullable<this["visible"]>[number]) =>
    this.selected !== null && this.selected.id === member.id;

  listener1 = (member: NonNullable<this["visible"]>[number]) => () => this.pick(member);

  get value2() {
    return this.page > 1;
  }

  listener2 = () => {
    if (!(this.page > 1)) return;
    this.page -= 1;
    this.args.onMoved?.(this.page);
  };

  get value3() {
    return this.page < this.pageCount;
  }

  listener3 = () => {
    if (!(this.page < this.pageCount)) return;
    this.page += 1;
    this.args.onMoved?.(this.page);
  };

  get value4() {
    return this.selected ? `Selected: ${this.selected.name}` : "Nobody selected";
  }

  listener4 = (event: HTMLElementEventMap["input"]) =>
    (this.draft = { ...this.draft, email: (event.currentTarget as HTMLInputElement).value });

  get value5() {
    return this.byPassword ? "Use a link" : "Use a password";
  }

  listener5 = () => (this.byPassword = !this.byPassword);

  <template><section
      class="team-invite"
      aria-label="Invite"
      style={{fallthroughStyle @style}}
      ...attributes
    ><h2>{{this.greeting}}</h2><ul
      aria-label="Members"
    >{{#each this.visible key="id" as |member|}}<li><button
      type="button"
      aria-pressed={{enumeratedValue (this.value1 member)}}
      {{on "click" (this.listener1 member)}}
    >{{member.name}}</button></li>{{/each}}</ul><div
      class="pager"
      role="group"
      aria-label="Pages"
    >{{#if this.value2}}<button type="button" {{on "click" this.listener2}}>Previous</button>{{/if}}<span>Page {{this.page}} of {{this.pageCount}}</span>{{#if this.value3}}<button
      type="button"
      {{on "click" this.listener3}}
    >Next</button>{{/if}}</div><p role="status">{{this.value4}}</p><button
      type="button"
      {{on "click" this.invite}}
    >Invite</button><button type="button" {{on "click" this.remove}}>Remove</button><form
      aria-label="Email invite"
      {{on "submit" this.submit}}
    ><label>Email<input type="email" name="email" {{on "input" this.listener4}}></label><button
      type="submit"
    >Send</button></form><button type="button" {{on "click" this.tag}}>Tag as team</button><button
      type="button"
      {{on "click" this.listener5}}
    >{{this.value5}}</button><div
      class="field"
    >{{#if this.byPassword}}<input type="password" aria-label="Password">{{else}}<input
      type="text"
      aria-label="Sign-in email"
    ><small>We send you a link.</small>{{/if}}</div><button
      type="button"
      {{on "click" this.start}}
    >Start the clock</button><button type="button" {{on "click" this.stop}}>Stop the clock</button><p>Seconds: {{this.seconds}}</p></section>{{(this.onMounted)}}</template>
}

/** Runs `run` once the render settles, unless its component is gone by then. */
function afterRender(owner: object, run: () => unknown): void {
  // A component on the server never mounts, as Vue registers no hook in a server render.
  if (import.meta.env.SSR) return;
  void renderSettled().then(() => {
    if (!isDestroying(owner)) void run();
  });
}

/** An enumerated attribute's value: a boolean as its name, any other value as it is. */
function enumeratedValue<T>(value: T): Exclude<T, boolean> | "true" | "false" {
  return typeof value === "boolean"
    ? (String(value) as "true" | "false")
    : (value as Exclude<T, boolean>);
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
