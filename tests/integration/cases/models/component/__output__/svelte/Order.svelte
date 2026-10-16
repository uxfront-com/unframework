<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Stepper from "./Stepper.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let cups = $state(2);
</script>

<section aria-label="Order" class={className} {style}>
  <Stepper label="Cups" bind:value={cups} /><output>Ordered: {cups}</output
  ><button type="button" onclick={() => (cups = 0)}>Clear</button>
</section>
