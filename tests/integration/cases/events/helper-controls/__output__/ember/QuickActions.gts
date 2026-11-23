import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface QuickActionsProps {
  actions: string[];
}

export interface QuickActionsEvents {
  onWelcomed?: () => void;
  onSubscribed?: (count: number) => void;
  onChosen?: (action: string, scope: string) => void;
}

export interface QuickActionsSignature {
  Args: QuickActionsProps & { style?: unknown } & QuickActionsEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class QuickActions extends Component<QuickActionsSignature> {
  clear = (event: KeyboardEvent) => {
    event.preventDefault();
    this.query = "";
  };

  track = (event: KeyboardEvent): boolean => {
    this.lastKey = event.key;
    return event.key === "Enter";
  };

  keyFor = (action: string, event: KeyboardEvent): boolean => {
    this.lastKey = `${action}: ${event.key}`;
    return false;
  };

  choose = (action: string, current: string) => {
    this.args.onChosen?.(action, current);
  };

  @tracked query = "";

  @tracked lastKey = "none";

  @tracked scope = "mine";

  @tracked subscriptions = 0;

  listener1 = (event: HTMLElementEventMap["input"]) =>
    (this.query = (event.currentTarget as HTMLInputElement).value);

  listener2 = (event: HTMLElementEventMap["keydown"]) => {
    if (event.key === "Escape") this.clear(event);
  };

  listener3 = (event: HTMLElementEventMap["keydown"]) => this.track(event);

  listener4 = (event: HTMLElementEventMap["change"]) =>
    (this.scope = (event.currentTarget as HTMLSelectElement).value);

  value1 = (action_1: NonNullable<this["args"]["actions"]>[number]) => `Shortcut for ${action_1}`;

  listener5 =
    (action_1: NonNullable<this["args"]["actions"]>[number]) =>
    (event: HTMLElementEventMap["keydown"]) =>
      this.keyFor(action_1, event);

  value2 = (action_1: NonNullable<this["args"]["actions"]>[number]) => `Run ${action_1}`;

  listener6 = (action_1: NonNullable<this["args"]["actions"]>[number]) => () =>
    this.choose(action_1, this.scope);

  listener7 = (event: HTMLElementEventMap["submit"]) => {
    event.preventDefault();
    this.args.onWelcomed?.();
  };

  listener8 = (event: HTMLElementEventMap["submit"]) => {
    event.preventDefault();
    this.subscriptions += 1;
    this.args.onSubscribed?.(this.subscriptions);
  };

  <template><section
      class="quick-actions"
      aria-label="Quick actions"
      style={{fallthroughStyle @style}}
      ...attributes
    ><label>Search<input name="query" {{on "input" this.listener1}} {{on "keydown" this.listener2}}></label><p>Query: {{this.query}}</p><label>Note<input
      name="note"
      {{on "keydown" this.listener3}}
    ></label><label>Scope<select
      name="scope"
      {{on "change" this.listener4}}
    ><option value="mine">Mine</option><option value="team">Team</option></select></label><ul
      aria-label="Actions"
    >{{#each @actions key="@identity" as |action_1|}}<li><label>{{this.value1 action_1}}<input
      name={{action_1}}
      {{on "keydown" (this.listener5 action_1)}}
    ></label><button
      type="button"
      {{on "click" (this.listener6 action_1)}}
    >{{this.value2 action_1}}</button></li>{{/each}}</ul><p>Last key: {{this.lastKey}}</p><form
      class="subscribe"
      aria-label="Subscribe"
      {{on "submit" this.listener7 once=true}}
      {{on "submit" this.listener8}}
    ><p>Subscriptions: {{this.subscriptions}}</p><button type="submit">Subscribe</button></form></section></template>
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
