<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let size = $state("m");
</script>

<section aria-label="Size" class={className} {style}>
  <label>Size <select
    bind:value={size}
  ><option value="s">Small</option><option value="m">Medium</option><option value="l">Large</option></select></label
  ><output>Chosen: {size}</output
  ><button type="button" onclick={() => (size = "l")}>Largest</button>
</section>
