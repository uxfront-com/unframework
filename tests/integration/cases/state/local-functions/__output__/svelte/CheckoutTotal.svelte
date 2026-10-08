<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export type ShippingMethod = "standard" | "express";

  export interface CheckoutTotalProps {
    /** The order's subtotal, in cents. */
    subtotal: number;
  }

  type Props = CheckoutTotalProps & { onshippingchange?: (method: ShippingMethod) => void };

  let { subtotal, onshippingchange }: Props = $props();

  const rates = { standard: 0, express: 1200 };

  function formatCents(cents: number): string {
    return `EUR ${(cents / 100).toFixed(2)}`;
  }

  let method = $state<ShippingMethod>("standard");
  const shipping = $derived(rates[method]);
  const total = $derived(formatCents(subtotal + shipping));

  function choose(next: ShippingMethod) {
    method = next;
    onshippingchange?.(next);
  }

  const chooseExpress = () => {
    choose("express");
  };

  function chooseStandard() {
    choose("standard");
  }
</script>

<section class="checkout-total" aria-label="Order total">
  <p>Subtotal: {formatCents(subtotal)}</p
  ><p>Shipping: {formatCents(shipping)}</p
  ><p role="status">Total: {total}</p
  ><button
    type="button"
    aria-pressed={method === "standard"}
    onclick={chooseStandard}
  >Standard shipping</button
  ><button
    type="button"
    aria-pressed={method === "express"}
    onclick={chooseExpress}
  >Express shipping</button>
</section>
