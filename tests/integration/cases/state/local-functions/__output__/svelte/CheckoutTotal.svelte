<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export type ShippingMethod = "standard" | "express";

  export interface CheckoutTotalProps {
    /** The order's subtotal, in cents. */
    subtotal: number;
  }

  type Props = CheckoutTotalProps & {
    onshippingchange?: (method: ShippingMethod) => void;
    class?: ClassValue;
    style?: string;
  };

  let { subtotal, onshippingchange, class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["checkout-total", className]}
  aria-label="Order total"
  {style}
  {...scopeAttributes(attributes)}
>
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
