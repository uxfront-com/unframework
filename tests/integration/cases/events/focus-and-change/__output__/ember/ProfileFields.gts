import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface ProfileFieldsEvents {
  onFirstNickname?: (nickname: string) => void;
}

export interface ProfileFieldsSignature {
  Args: { style?: unknown } & ProfileFieldsEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class ProfileFields extends Component<ProfileFieldsSignature> {
  record = (line: string) => {
    this.log = [...this.log, line];
  };

  hold = (event: MouseEvent) => {
    event.preventDefault();
    this.record("locked click");
  };

  @tracked log: string[] = [];

  @tracked nickname = "";

  @tracked cardFocuses = 0;

  @tracked cardBlurs = 0;

  listener1 = () => this.record("name focus");

  listener2 = () => this.record("name blur");

  listener3 = () => this.record("group focusin");

  listener4 = () => this.record("group focusout");

  listener5 = (event: HTMLElementEventMap["change"]) =>
    (this.nickname = (event.currentTarget as HTMLInputElement).value);

  listener6 = (event: HTMLElementEventMap["change"]) =>
    this.args.onFirstNickname?.((event.currentTarget as HTMLInputElement).value);

  listener7 = () => this.record("public click");

  listener8 = () => this.record("public input");

  listener9 = () => this.record("public change");

  listener10 = () => this.record("locked change");

  get value1() {
    return this.cardFocuses > this.cardBlurs ? "Card focused" : "Card not focused";
  }

  listener11 = () => this.record("card button");

  listener12 = () => this.cardFocuses++;

  listener13 = () => this.cardBlurs++;

  <template><section
      class="profile-fields"
      aria-label="Profile"
      style={{fallthroughStyle @style}}
      ...attributes
    ><div
      class="name-group"
      role="group"
      aria-label="Name fields"
      {{on "focusin" this.listener3}}
      {{on "focusout" this.listener4}}
    ><label>Name<input name="name" {{on "focus" this.listener1}} {{on "blur" this.listener2}}></label></div><label>Nickname<input
      name="nickname"
      {{on "change" this.listener5}}
      {{on "change" this.listener6 once=true}}
    ></label><p>Nickname: {{this.nickname}}</p><label><input
      type="checkbox"
      name="public"
      {{on "click" this.listener7}}
      {{on "input" this.listener8}}
      {{on "change" this.listener9}}
    >Public profile</label><label><input
      type="checkbox"
      name="locked"
      {{on "click" this.hold}}
      {{on "change" this.listener10}}
    >Locked</label><div
      class="card"
      role="group"
      aria-label="Card"
      tabindex="-1"
      {{on "focus" this.listener12}}
      {{on "blur" this.listener13}}
    ><p>{{this.value1}}</p><p>Card blurs: {{this.cardBlurs}}</p><button
      type="button"
      {{on "click" this.listener11}}
    >Inside the card</button></div><ol
      aria-label="Log"
    >{{#each this.log key="@index" as |entry|}}<li>{{entry}}</li>{{/each}}</ol></section></template>
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
