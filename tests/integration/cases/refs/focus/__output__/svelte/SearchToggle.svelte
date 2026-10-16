<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();

  let field: HTMLInputElement | null = null;
  let trigger: HTMLButtonElement | null = null;

  function focusField() {
    field?.focus();
  }

  function returnFocus(event: KeyboardEvent) {
    if (event.key === "Escape") trigger?.focus();
  }
</script>

<div class={["search-toggle", className]} role="search" {style}>
  <button type="button" bind:this={trigger} onclick={focusField}>Search</button
  ><input name="query" aria-label="Search the docs" bind:this={field} onkeydown={returnFocus} />
</div>
