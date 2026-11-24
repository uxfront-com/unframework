<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface OrderStatusProps {
    status: "pending" | "shipped" | "delivered" | "cancelled";
    carrier?: string;
    eta?: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["p"],
    "status" | "carrier" | "eta" | "children" | "class" | "style" | "ref"
  > &
    OrderStatusProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["p"] | null;
    };

  let {
    status,
    carrier,
    eta,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<p class={["order-status", className]} {style} bind:this={ref} {...attributes}>
  {#if status === "pending"}Waiting for payment.{:else if status === "shipped"}<strong>Shipped</strong> with {carrier ?? "our courier"}, arriving {eta ?? "soon"}.{:else if status === "delivered"}<strong>Delivered</strong>{:else}<em>Cancelled</em>{/if}
</p>
