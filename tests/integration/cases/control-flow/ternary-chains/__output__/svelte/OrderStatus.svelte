<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface OrderStatusProps {
    status: "pending" | "shipped" | "delivered" | "cancelled";
    carrier?: string;
    eta?: string;
  }

  let { status, carrier, eta }: OrderStatusProps = $props();
</script>

<p class="order-status">
  {#if status === "pending"}Waiting for payment.{:else if status === "shipped"}<strong>Shipped</strong> with {carrier ?? "our courier"}, arriving {eta ?? "soon"}.{:else if status === "delivered"}<strong>Delivered</strong>{:else}<em>Cancelled</em>{/if}
</p>
