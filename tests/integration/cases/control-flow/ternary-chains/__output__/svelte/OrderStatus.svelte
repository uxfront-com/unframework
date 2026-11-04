<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface OrderStatusProps {
    status: "pending" | "shipped" | "delivered" | "cancelled";
    carrier?: string;
    eta?: string;
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = OrderStatusProps & { class?: ClassValue; style?: string };

  let { status, carrier, eta, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<p class={["order-status", className]} {style} {...scopeAttributes(attributes)}>
  {#if status === "pending"}Waiting for payment.{:else if status === "shipped"}<strong>Shipped</strong> with {carrier ?? "our courier"}, arriving {eta ?? "soon"}.{:else if status === "delivered"}<strong>Delivered</strong>{:else}<em>Cancelled</em>{/if}
</p>
