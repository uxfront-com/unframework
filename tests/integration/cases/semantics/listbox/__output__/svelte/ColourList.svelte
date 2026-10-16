<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let colour = $state("none");
</script>

<section aria-label="Colours" class={className} {style}>
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
