<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let agreed = $state(false);
</script>

<section aria-label="Terms" class={className} {style}>
  <label><input type="checkbox" bind:checked={agreed} /> I agree</label
  ><output>{agreed ? "Agreed" : "Not agreed"}</output
  ><button type="button" onclick={() => (agreed = !agreed)}>Toggle</button>
</section>
