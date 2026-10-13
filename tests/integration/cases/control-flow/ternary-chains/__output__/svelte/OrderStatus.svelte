<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface OrderStatusProps {
    status: "pending" | "shipped" | "delivered" | "cancelled";
    carrier?: string;
    eta?: string;
  }

  type Props = OrderStatusProps & { class?: ClassValue; style?: string };

  let { status, carrier, eta, class: className, style }: Props = $props();
</script>

<p class={["order-status", className]} {style}>
  {#if status === "pending"}Waiting for payment.{:else if status === "shipped"}<strong>Shipped</strong> with {carrier ?? "our courier"}, arriving {eta ?? "soon"}.{:else if status === "delivered"}<strong>Delivered</strong>{:else}<em>Cancelled</em>{/if}
</p>
