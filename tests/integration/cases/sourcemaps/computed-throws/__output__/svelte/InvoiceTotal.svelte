<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface InvoiceTotalProps {
    quantity: number;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "quantity" | "children" | "class" | "style" | "ref"
  > &
    InvoiceTotalProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["div"] | null;
    };

  let { quantity, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let refunded = $state(0);

  const total = $derived.by(() => {
    const units = quantity - refunded;
    if (units < 0) {
      throw new Error("The total is negative");
    }
    return units * 5;
  });

  function refund() {
    refunded = refunded + 3;
  }
</script>

<div class={className} {style} bind:this={ref} {...attributes}>
  <output>{`${total} after ${refunded} refunded`}</output
  ><button type="button" onclick={refund}>Refund</button>
</div>
