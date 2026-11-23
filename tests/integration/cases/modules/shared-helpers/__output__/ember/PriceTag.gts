import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { formatPrice, pluralise } from "./format";

export interface PriceTagEvents {
  onOrder?: (summary: string) => void;
}

export interface PriceTagSignature {
  Args: { cents: number } & { style?: unknown } & PriceTagEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class PriceTag extends Component<PriceTagSignature> {
  order = () => {
    this.args.onOrder?.(`${pluralise(this.quantity, "item")} for ${this.total}`);
  };

  @tracked quantity = 1;

  get total() {
    return formatPrice(this.args.cents * this.quantity);
  }

  get value1() {
    return formatPrice(this.args.cents);
  }

  get value2() {
    return pluralise(this.quantity, "item");
  }

  listener1 = () => this.quantity++;

  <template><section
      class="price-tag"
      aria-label="Price"
      style={{fallthroughStyle @style}}
      ...attributes
    ><p>Each: {{this.value1}}</p><p role="status">{{this.value2}}: {{this.total}}</p><button
      type="button"
      {{on "click" this.listener1}}
    >One more</button><button type="button" {{on "click" this.order}}>Order</button></section></template>
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
