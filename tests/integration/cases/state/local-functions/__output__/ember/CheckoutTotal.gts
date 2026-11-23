import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export type ShippingMethod = "standard" | "express";

export interface CheckoutTotalProps {
  /** The order's subtotal, in cents. */
  subtotal: number;
}

export interface CheckoutTotalEvents {
  onShippingChange?: (method: ShippingMethod) => void;
}

export interface CheckoutTotalSignature {
  Args: CheckoutTotalProps & { style?: unknown } & CheckoutTotalEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class CheckoutTotal extends Component<CheckoutTotalSignature> {
  formatCents = (cents: number): string => {
    return `EUR ${(cents / 100).toFixed(2)}`;
  };

  choose = (next: ShippingMethod) => {
    this.method = next;
    this.args.onShippingChange?.(next);
  };

  chooseExpress = () => {
    this.choose("express");
  };

  chooseStandard = () => {
    this.choose("standard");
  };

  readonly rates = { standard: 0, express: 1200 };

  @tracked method: ShippingMethod = "standard";

  get shipping() {
    return this.rates[this.method];
  }

  get total() {
    return this.formatCents(this.args.subtotal + this.shipping);
  }

  get value1() {
    return this.formatCents(this.args.subtotal);
  }

  get value2() {
    return this.formatCents(this.shipping);
  }

  get value3() {
    return this.method === "standard";
  }

  get value4() {
    return this.method === "express";
  }

  <template><section
      class="checkout-total"
      aria-label="Order total"
      style={{fallthroughStyle @style}}
      ...attributes
    ><p>Subtotal: {{this.value1}}</p><p>Shipping: {{this.value2}}</p><p
      role="status"
    >Total: {{this.total}}</p><button
      type="button"
      aria-pressed={{enumeratedValue this.value3}}
      {{on "click" this.chooseStandard}}
    >Standard shipping</button><button
      type="button"
      aria-pressed={{enumeratedValue this.value4}}
      {{on "click" this.chooseExpress}}
    >Express shipping</button></section></template>
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
