<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { modelText } from "./_unframework/modelText.svelte";
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let count = $state(2);
  let volume = $state(5);

  const countField = { value: untrack(() => count) };
  const volumeField = { value: untrack(() => volume) };
</script>

<section aria-label="Order" class={className} {style} bind:this={ref} {...attributes}>
  <input
    type="number"
    aria-label="Count"
    min="0"
    {...countField} {@attach modelText(() => count, (value) => (count = value), { number: true })}
  /><input
    type="range"
    aria-label="Volume"
    min="0"
    max="10"
    {...volumeField} {@attach modelText(() => volume, (value) => (volume = value), { number: true })}
  /><output>Next: {count + 1}, volume {volume + 1}</output
  ><button type="button" onclick={() => (count = 10)}>Ten</button>
</section>
