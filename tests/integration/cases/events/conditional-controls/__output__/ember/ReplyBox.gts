import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface ReplyBoxSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class ReplyBox extends Component<ReplyBoxSignature> {
  accept = (event: KeyboardEvent) => {
    event.preventDefault();
    this.suggesting = false;
    this.accepted += 1;
  };

  @tracked started = false;

  @tracked suggesting = false;

  @tracked accepted = 0;

  listener1 = (event: HTMLElementEventMap["keydown"]) => {
    if (event.key === "Enter") event.preventDefault();
    this.started = true;
  };

  get value1() {
    return this.started ? "Started" : "Not started";
  }

  listener2 = (event: HTMLElementEventMap["keydown"]) => {
    if (this.suggesting && event.key === "Enter") this.accept(event);
  };

  listener3 = () => (this.suggesting = !this.suggesting);

  <template><section
      class="reply-box"
      aria-label="Reply"
      style={{fallthroughStyle @style}}
      ...attributes
    ><label>Message<textarea name="message" {{on "keydown" this.listener1 once=true}}></textarea></label><p>{{this.value1}}</p><label>Answer<textarea
      name="answer"
      {{on "keydown" this.listener2}}
    ></textarea></label><button
      type="button"
      aria-pressed={{enumeratedValue this.suggesting}}
      {{on "click" this.listener3}}
    >Suggestions</button><p>Accepted: {{this.accepted}}</p></section></template>
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
