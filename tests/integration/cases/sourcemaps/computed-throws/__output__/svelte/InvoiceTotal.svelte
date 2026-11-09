<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface InvoiceTotalProps {
    quantity: number;
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = InvoiceTotalProps & { class?: ClassValue; style?: string };

  let { quantity, class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={className} {style} {...scopeAttributes(attributes)}>
  <output>{total}</output><button type="button" onclick={refund}>Refund</button>
</div>
