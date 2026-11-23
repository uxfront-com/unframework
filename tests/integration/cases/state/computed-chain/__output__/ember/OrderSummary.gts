import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface OrderSummaryProps {
  /** The unit price, in cents. */
  price: number;
  taxRate: number;
}

export interface OrderSummarySignature {
  Args: OrderSummaryProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class OrderSummary extends Component<OrderSummarySignature> {
  @tracked quantity = 1;

  get subtotal() {
    return this.quantity * this.args.price;
  }

  get tax() {
    return Math.round(this.subtotal * this.args.taxRate);
  }

  get total() {
    return this.subtotal + this.tax;
  }

  get tier() {
    if (this.total >= 10000) return "bulk";
    return "standard";
  }

  get value1() {
    return this.quantity === 1;
  }

  listener1 = () => this.quantity--;

  listener2 = () => this.quantity++;

  get value2() {
    return (this.subtotal / 100).toFixed(2);
  }

  get value3() {
    return (this.tax / 100).toFixed(2);
  }

  get value4() {
    return (this.total / 100).toFixed(2);
  }

  <template><section
      class="order-summary"
      aria-label="Order summary"
      data-tier={{this.tier}}
      style={{fallthroughStyle @style}}
      ...attributes
    ><p role="status">Quantity: {{this.quantity}}</p><button
      type="button"
      disabled={{this.value1}}
      {{on "click" this.listener1}}
    >Remove one</button><button type="button" {{on "click" this.listener2}}>Add one</button><p>Subtotal: {{this.value2}}</p><p>Tax: {{this.value3}}</p><p>Total: {{this.value4}}</p></section></template>
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
