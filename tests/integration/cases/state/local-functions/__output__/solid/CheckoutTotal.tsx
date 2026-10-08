import { createMemo, createSignal } from "solid-js";

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

export default function CheckoutTotal(props: CheckoutTotalProps & CheckoutTotalEvents) {
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
    <section class="checkout-total" aria-label="Order total">
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
