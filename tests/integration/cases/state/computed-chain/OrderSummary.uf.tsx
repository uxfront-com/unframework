import { computed, ref } from "unframework";

export interface OrderSummaryProps {
  /** The unit price, in cents. */
  price: number;
  taxRate: number;
}

export default function OrderSummary({ price, taxRate }: OrderSummaryProps) {
  const quantity = ref(1);
  const subtotal = computed(() => quantity.value * price);
  const tax = computed(() => Math.round(subtotal.value * taxRate));
  const total = computed(() => subtotal.value + tax.value);
  const tier = computed(() => {
    if (total.value >= 10000) return "bulk";
    return "standard";
  });

  return (
    <section class="order-summary" aria-label="Order summary" data-tier={tier.value}>
      <p role="status">Quantity: {quantity.value}</p>
      <button type="button" disabled={quantity.value === 1} onClick={() => quantity.value--}>
        Remove one
      </button>
      <button type="button" onClick={() => quantity.value++}>
        Add one
      </button>
      <p>Subtotal: {(subtotal.value / 100).toFixed(2)}</p>
      <p>Tax: {(tax.value / 100).toFixed(2)}</p>
      <p>Total: {(total.value / 100).toFixed(2)}</p>
    </section>
  );
}
