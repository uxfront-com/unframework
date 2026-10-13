<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import PriceRange from "./PriceRange.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let low = $state(20);
  let high = $state(50);
</script>

<section aria-label="Search" class={className} {style}>
  <PriceRange label="Price" bind:min={low} bind:max={high}
  /><output>Between {low} and {high}</output
  ><button type="button" onclick={() => (high = 40)}>Cheaper</button>
</section>
