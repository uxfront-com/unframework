import { type JSX, createMemo, createSignal } from "solid-js";

export type ShippingMethod = "standard" | "express";

export interface CheckoutTotalProps {
  /** The order's subtotal, in cents. */
  subtotal: number;
}

export interface CheckoutTotalEvents {
  onShippingChange?: (method: ShippingMethod) => void;
}

const rates = { standard: 0, express: 1200 };

function formatCents(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

export default function CheckoutTotal(
  props: CheckoutTotalProps & CheckoutTotalEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [method, setMethod] = createSignal<ShippingMethod>("standard");
  const shipping = createMemo(() => rates[method()]);
  const total = createMemo(() => formatCents(props.subtotal + shipping()));

  function choose(next: ShippingMethod) {
    setMethod(next);
    props.onShippingChange?.(next);
  }

  const chooseExpress = () => {
    choose("express");
  };

  function chooseStandard() {
    choose("standard");
  }

  return (
    <section
      class={props.class ? `checkout-total ${props.class}` : "checkout-total"}
      aria-label="Order total"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p>Subtotal: {formatCents(props.subtotal)}</p>
      <p>Shipping: {formatCents(shipping())}</p>
      <p role="status">Total: {total()}</p>
      <button type="button" aria-pressed={method() === "standard"} onClick={chooseStandard}>
        Standard shipping
      </button>
      <button type="button" aria-pressed={method() === "express"} onClick={chooseExpress}>
        Express shipping
      </button>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
