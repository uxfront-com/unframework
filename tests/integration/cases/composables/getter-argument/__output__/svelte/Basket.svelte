<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useTotal } from "./useTotal.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "price" | "children" | "class" | "style" | "ref"
  > & {
    price: number;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { price, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let quantity = $state(1);
  const total = useTotal(
    () => price,
    () => quantity,
  );
</script>

<section class={["basket", className]} aria-label="Basket" {style} bind:this={ref} {...attributes}>
  <p role="status">Total: {total.total}</p
  ><p>{total.label}</p
  ><button type="button" onclick={() => quantity++}>Add one</button>
</section>
