import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { useControllableState } from "./useControllableState.ts";

export interface RatingEvents {
  onChange?: (value: number) => void;
}

export interface RatingSignature {
  Args: { value?: number } & { style?: unknown } & RatingEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class Rating extends Component<RatingSignature> {
  readonly controllableState = useControllableState(
    this,
    () => this.args.value,
    1,
    (next) => this.args.onChange?.(next),
  );

  listener1 = () => this.controllableState.set(2);

  listener2 = () => this.controllableState.set(3);

  <template><section
      class="rating"
      aria-label="Rating"
      style={{fallthroughStyle @style}}
      ...attributes
    ><p role="status">Rated {{this.controllableState.current}} of 3</p><button
      type="button"
      {{on "click" this.listener1}}
    >Two</button><button type="button" {{on "click" this.listener2}}>Three</button></section></template>
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
