<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import SearchField from "./SearchField.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let search: { focus(): void } | null = null;
</script>

<header class={["header", className]} {style}>
  <SearchField bind:this={search} label="Find"
  /><button type="button" onclick={() => search?.focus()}>Search</button>
</header>
