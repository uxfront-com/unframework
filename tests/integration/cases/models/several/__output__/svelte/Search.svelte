<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import PriceRange from "./PriceRange.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let low = $state(20);
  let high = $state(50);
</script>

<section aria-label="Search" class={className} {style} bind:this={ref} {...attributes}>
  <PriceRange label="Price" bind:min={low} bind:max={high}
  /><output>Between {low} and {high}</output
  ><button type="button" onclick={() => (high = 40)}>Cheaper</button>
</section>
