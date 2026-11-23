import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface OrderSummaryProps {
  customer: string;
  orderNumber: number;
  unitPrice: number;
  quantity: number;
  discount: number;
  coupon?: string;
}

export interface OrderSummarySignature {
  Args: OrderSummaryProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class OrderSummary extends Component<OrderSummarySignature> {
  get value1() {
    return String(this.args.orderNumber).padStart(6, "0");
  }

  get value2() {
    return this.args.customer.trim().toUpperCase();
  }

  get value3() {
    return `${this.args.quantity} item${this.args.quantity === 1 ? "" : "s"} at ${this.args.unitPrice.toFixed(2)} each`;
  }

  get value4() {
    return (this.args.unitPrice * this.args.quantity).toFixed(2);
  }

  get value5() {
    return Math.min(Math.max(this.args.discount, 0), 50);
  }

  get value6() {
    return (
      this.args.unitPrice *
      this.args.quantity *
      (1 - Math.min(Math.max(this.args.discount, 0), 50) / 100)
    ).toFixed(2);
  }

  get value7() {
    return this.args.quantity > 10 ? "Bulk order" : "Standard order";
  }

  get value8() {
    return this.args.coupon ? "coupon applied" : "no coupon";
  }

  get value9() {
    return Math.round(this.args.unitPrice * this.args.quantity) % 100;
  }

  <template><section
      class="order-summary"
      aria-label="Order summary"
      style={{fallthroughStyle @style}}
      ...attributes
    ><h2>Order {{this.value1}}</h2><p>Customer: {{this.value2}}</p><p>{{this.value3}}</p><p>Subtotal: {{this.value4}}</p><p>Discount: {{this.value5}}%</p><p>Total: {{this.value6}}</p><p>{{this.value7}}, {{this.value8}}</p><p>Points earned: {{this.value9}}</p></section></template>
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
