import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface CommentCardEvents {
  onLiked?: (liked: boolean, by: string) => void;
}

export interface CommentCardSignature {
  Args: { style?: unknown } & CommentCardEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class CommentCard extends Component<CommentCardSignature> {
  autosize = (event: Event) => {
    const area = event.currentTarget as HTMLTextAreaElement;
    this.text = area.value;
    area.style.height = `${Math.max(area.value.split("\n").length, 2) * 1.5}em`;
  };

  toggleLike = (event: MouseEvent | KeyboardEvent) => {
    this.liked = !this.liked;
    this.args.onLiked?.(this.liked, event.type);
  };

  onLikeKeydown = (event: KeyboardEvent) => {
    if (event.key === " ") event.preventDefault();
    if (event.key === "Enter" || event.key === " ") this.toggleLike(event);
  };

  @tracked text = "";

  @tracked liked = false;

  get value1() {
    return styleText([["width", `${Math.min(this.text.length, 100)}%`]]);
  }

  <template><section
      class="comment-card"
      aria-label="Comment"
      style={{fallthroughStyle @style}}
      ...attributes
    ><label>Comment<textarea name="comment" rows="2" {{on "input" this.autosize}}></textarea></label><div
      class="meter"
      role="presentation"
    ><div class="fill" style={{this.value1}}></div></div><p>{{this.text.length}} characters</p><div
      class="like"
      role="button"
      tabindex="0"
      aria-pressed={{enumeratedValue this.liked}}
      {{on "click" this.toggleLike}}
      {{on "keydown" this.onLikeKeydown}}
    >Like</div></section></template>
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

/**
 * A style from its declarations, those whose value is nullish left out, marked safe. A
 * declaration without a property is a whole style: a declaration list, or an object whose keys
 * may be in camel case, as Vue's `normalizeStyle` reads them.
 */
function styleText(
  declarations: readonly (readonly [string, unknown])[],
): ReturnType<typeof htmlSafe> | undefined {
  const parts: string[] = [];
  const add = (property: string, value: unknown): void => {
    if (value === undefined || value === null) return;
    if (property) parts.push(`${property}: ${String(value)}`);
    else if (typeof value === "string") parts.push(value.trim().replace(/;$/, ""));
    else if (typeof value === "object") {
      for (const [key, each] of Object.entries(value)) {
        add(
          key.startsWith("--")
            ? key
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          each,
        );
      }
    }
  };
  for (const [property, value] of declarations) add(property, value);
  const text = parts.filter(Boolean).join("; ");
  return text ? htmlSafe(text) : undefined;
}
