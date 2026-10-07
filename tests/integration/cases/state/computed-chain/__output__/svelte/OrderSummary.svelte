<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface OrderSummaryProps {
    /** The unit price, in cents. */
    price: number;
    taxRate: number;
  }

  let { price, taxRate }: OrderSummaryProps = $props();

  let quantity = $state(1);
  const subtotal = $derived(quantity * price);
  const tax = $derived(Math.round(subtotal * taxRate));
  const total = $derived(subtotal + tax);

  const tier = $derived.by(() => {
    if (total >= 10000) return "bulk";
    return "standard";
  });
</script>

<section class="order-summary" aria-label="Order summary" data-tier={tier}>
  <p role="status">Quantity: {quantity}</p
  ><button type="button" disabled={quantity === 1} onclick={() => quantity--}>Remove one</button
  ><button type="button" onclick={() => quantity++}>Add one</button
  ><p>Subtotal: {(subtotal / 100).toFixed(2)}</p
  ><p>Tax: {(tax / 100).toFixed(2)}</p
  ><p>Total: {(total / 100).toFixed(2)}</p>
</section>
