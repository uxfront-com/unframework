<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Stepper from "./Stepper.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let cups = $state(2);
</script>

<section aria-label="Order" class={className} {style} bind:this={ref} {...attributes}>
  <Stepper label="Cups" bind:value={cups} /><output>Ordered: {cups}</output
  ><button type="button" onclick={() => (cups = 0)}>Clear</button>
</section>
