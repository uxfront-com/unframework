import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface OrderStatusProps {
  status: "pending" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  eta?: string;
}

export interface OrderStatusSignature {
  Args: OrderStatusProps & { style?: unknown };
  Element: HTMLElementTagNameMap["p"];
}

export default class OrderStatus extends Component<OrderStatusSignature> {
  get value1() {
    return this.args.status === "pending";
  }

  get value2() {
    return this.args.status === "shipped";
  }

  get value3() {
    return this.args.status === "delivered";
  }

  get value4() {
    return this.args.carrier ?? "our courier";
  }

  get value5() {
    return this.args.eta ?? "soon";
  }

  <template><p
      class="order-status"
      style={{fallthroughStyle @style}}
      ...attributes
    >{{#if this.value1}}Waiting for payment.{{else if this.value2}}<strong>Shipped</strong> with {{this.value4}}, arriving {{this.value5}}.{{else if this.value3}}<strong>Delivered</strong>{{else}}<em>Cancelled</em>{{/if}}</p></template>
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
