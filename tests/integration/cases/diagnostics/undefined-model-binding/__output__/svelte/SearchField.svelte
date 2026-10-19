<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { query?: string; class?: ClassValue; style?: string };

  let { query = $bindable(), class: className, style }: Props = $props();
</script>

<input type="search" aria-label="Search" bind:value={query} class={className} {style} />
