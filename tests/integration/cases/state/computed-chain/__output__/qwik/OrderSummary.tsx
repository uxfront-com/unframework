import { component$, useComputed$, useSignal } from "@qwik.dev/core";

export interface OrderSummaryProps {
  /** The unit price, in cents. */
  price: number;
  taxRate: number;
}

export default component$<OrderSummaryProps>(({ price, taxRate }) => {
  const quantity = useSignal(1);
  const subtotal = useComputed$(() => quantity.value * price);
  const tax = useComputed$(() => Math.round(subtotal.value * taxRate));
  const total = useComputed$(() => subtotal.value + tax.value);
  const tier = useComputed$(() => {
    if (total.value >= 10000) return "bulk";
    return "standard";
  });

  return (
    <section class="order-summary" aria-label="Order summary" data-tier={tier.value}>
      <p role="status">Quantity: {quantity.value}</p>
      <button type="button" disabled={quantity.value === 1} onClick$={() => quantity.value--}>
        Remove one
      </button>
      <button type="button" onClick$={() => quantity.value++}>
        Add one
      </button>
      <p>Subtotal: {(subtotal.value / 100).toFixed(2)}</p>
      <p>Tax: {(tax.value / 100).toFixed(2)}</p>
      <p>Total: {(total.value / 100).toFixed(2)}</p>
    </section>
  );
});
