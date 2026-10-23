<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface OrderSummaryProps {
    /** The unit price, in cents. */
    price: number;
    taxRate: number;
  }

  type Props = OrderSummaryProps & { class?: ClassValue; style?: string };

  let { price, taxRate, class: className, style, ...attributes }: Props = $props();

  let quantity = $state(1);
  const subtotal = $derived(quantity * price);
  const tax = $derived(Math.round(subtotal * taxRate));
  const total = $derived(subtotal + tax);

  const tier = $derived.by(() => {
    if (total >= 10000) return "bulk";
    return "standard";
  });

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["order-summary", className]}
  aria-label="Order summary"
  data-tier={tier}
  {style}
  {...scopeAttributes(attributes)}
>
  <p role="status">Quantity: {quantity}</p
  ><button type="button" disabled={quantity === 1} onclick={() => quantity--}>Remove one</button
  ><button type="button" onclick={() => quantity++}>Add one</button
  ><p>Subtotal: {(subtotal / 100).toFixed(2)}</p
  ><p>Tax: {(tax / 100).toFixed(2)}</p
  ><p>Total: {(total / 100).toFixed(2)}</p>
</section>
