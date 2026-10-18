import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export type ShippingMethod = "standard" | "express";

export interface CheckoutTotalProps {
  /** The order's subtotal, in cents. */
  subtotal: number;
}

export interface CheckoutTotalEvents {
  onShippingChange$?: QRL<(method: ShippingMethod) => void>;
}

const rates = { standard: 0, express: 1200 };

function formatCents(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

export default component$<
  CheckoutTotalProps & CheckoutTotalEvents & { class?: ClassList; style?: CSSProperties }
>(({ subtotal, onShippingChange$, class: className, style }) => {
  const method = useSignal<ShippingMethod>("standard");
  const shipping = useComputed$(() => rates[method.value]);
  const total = useComputed$(() => formatCents(subtotal + shipping.value));

  const choose = $((next: ShippingMethod) => {
    method.value = next;
    onShippingChange$?.(next);
  });

  const chooseExpress = $(async () => {
    await choose("express");
  });

  const chooseStandard = $(async () => {
    await choose("standard");
  });

  return (
    <section class={["checkout-total", className]} aria-label="Order total" style={style}>
      <p>Subtotal: {formatCents(subtotal)}</p>
      <p>Shipping: {formatCents(shipping.value)}</p>
      <p role="status">Total: {total.value}</p>
      <button type="button" aria-pressed={method.value === "standard"} onClick$={chooseStandard}>
        Standard shipping
      </button>
      <button type="button" aria-pressed={method.value === "express"} onClick$={chooseExpress}>
        Express shipping
      </button>
    </section>
  );
});
