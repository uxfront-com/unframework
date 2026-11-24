<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let colour = $state("none");
</script>

<section aria-label="Colours" class={className} {style} bind:this={ref} {...attributes}>
  <select
    size="3"
    aria-label="Colour"
    onchange={(event) => (colour = (event.currentTarget as HTMLSelectElement).value)}
  >
    <option value="red">Red</option
    ><option value="green">Green</option
    ><option value="blue">Blue</option>
  </select
  ><output>Picked: {colour}</output>
</section>
