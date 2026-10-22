<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import PriceRange from "./PriceRange.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let low = $state(20);
  let high = $state(50);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Search" class={className} {style} {...scopeAttributes(attributes)}>
  <PriceRange label="Price" bind:min={low} bind:max={high}
  /><output>Between {low} and {high}</output
  ><button type="button" onclick={() => (high = 40)}>Cheaper</button>
</section>
