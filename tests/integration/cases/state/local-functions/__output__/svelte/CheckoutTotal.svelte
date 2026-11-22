<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export type ShippingMethod = "standard" | "express";

  export interface CheckoutTotalProps {
    /** The order's subtotal, in cents. */
    subtotal: number;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "subtotal" | "onshippingchange" | "children" | "class" | "style" | "ref"
  > &
    CheckoutTotalProps & {
      onshippingchange?: (method: ShippingMethod) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    subtotal,
    onshippingchange,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

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

<section
  class={["checkout-total", className]}
  aria-label="Order total"
  {style}
  bind:this={ref}
  {...attributes}
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
