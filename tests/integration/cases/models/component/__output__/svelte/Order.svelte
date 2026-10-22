<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Stepper from "./Stepper.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let cups = $state(2);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Order" class={className} {style} {...scopeAttributes(attributes)}>
  <Stepper label="Cups" bind:value={cups} /><output>Ordered: {cups}</output
  ><button type="button" onclick={() => (cups = 0)}>Clear</button>
</section>
