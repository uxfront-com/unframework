import { computed, defineEmits, ref } from "unframework";

export type ShippingMethod = "standard" | "express";

export interface CheckoutTotalProps {
  /** The order's subtotal, in cents. */
  subtotal: number;
}

export default function CheckoutTotal({ subtotal }: CheckoutTotalProps) {
  const emit = defineEmits<{ shippingChange: [method: ShippingMethod] }>();

  const rates = { standard: 0, express: 1200 };

  function formatCents(cents: number): string {
    return `EUR ${(cents / 100).toFixed(2)}`;
  }

  const method = ref<ShippingMethod>("standard");
  const shipping = computed(() => rates[method.value]);
  const total = computed(() => formatCents(subtotal + shipping.value));

  function choose(next: ShippingMethod) {
    method.value = next;
    emit("shippingChange", next);
  }

  const chooseExpress = () => {
    choose("express");
  };

  function chooseStandard() {
    choose("standard");
  }

  return (
    <section class="checkout-total" aria-label="Order total">
      <p>Subtotal: {formatCents(subtotal)}</p>
      <p>Shipping: {formatCents(shipping.value)}</p>
      <p role="status">Total: {total.value}</p>
      <button type="button" aria-pressed={method.value === "standard"} onClick={chooseStandard}>
        Standard shipping
      </button>
      <button type="button" aria-pressed={method.value === "express"} onClick={chooseExpress}>
        Express shipping
      </button>
    </section>
  );
}
