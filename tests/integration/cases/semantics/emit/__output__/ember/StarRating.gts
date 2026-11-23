import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface StarRatingEvents {
  onPreview?: (stars: number) => void;
  onRate?: (stars: number, previous: number) => void;
  onCleared?: () => void;
}

export interface StarRatingSignature {
  Args: { style?: unknown } & StarRatingEvents;
  Element: HTMLElementTagNameMap["div"];
}

export default class StarRating extends Component<StarRatingSignature> {
  choose = (next: number) => {
    const previous = this.stars;
    this.args.onPreview?.(next);
    this.stars = next;
    this.args.onRate?.(this.stars, previous);
  };

  clear = () => {
    for (let star = this.stars - 1; star >= 0; star--) {
      this.args.onPreview?.(star);
    }
    this.stars = 0;
    this.args.onCleared?.();
  };

  readonly choices = [1, 2, 3, 4, 5];

  @tracked stars = 0;

  value1 = (choice: NonNullable<this["choices"]>[number]) => (choice === 1 ? "star" : "stars");

  value2 = (choice: NonNullable<this["choices"]>[number]) => this.stars >= choice;

  listener1 = (choice: NonNullable<this["choices"]>[number]) => () => this.choose(choice);

  <template><div
      class="star-rating"
      role="group"
      aria-label="Rating"
      style={{fallthroughStyle @style}}
      ...attributes
    ><ul>{{#each this.choices key="@identity" as |choice|}}<li><button
      type="button"
      aria-pressed={{enumeratedValue (this.value2 choice)}}
      {{on "click" (this.listener1 choice)}}
    >{{choice}} {{this.value1 choice}}</button></li>{{/each}}</ul><p
      role="status"
    >{{this.stars}} of 5</p><button type="button" {{on "click" this.clear}}>Clear</button></div></template>
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
