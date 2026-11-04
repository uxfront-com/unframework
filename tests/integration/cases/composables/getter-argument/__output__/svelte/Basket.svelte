<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useTotal } from "./useTotal.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { price: number; class?: ClassValue; style?: string };

  let { price, class: className, style, ...attributes }: Props = $props();

  let quantity = $state(1);
  const total = useTotal(
    () => price,
    () => quantity,
  );

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["basket", className]} aria-label="Basket" {style} {...scopeAttributes(attributes)}>
  <p role="status">Total: {total.total}</p
  ><p>{total.label}</p
  ><button type="button" onclick={() => quantity++}>Add one</button>
</section>
