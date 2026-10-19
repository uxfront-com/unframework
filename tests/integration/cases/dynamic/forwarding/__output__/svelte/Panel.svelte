<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { title?: Snippet; class?: ClassValue; style?: string };

  let { title, class: className, style }: Props = $props();
</script>

<div class={["panel", className]} {style}>
  <h4>
    {#if title}{@render title()}{:else}Untitled{/if}
  </h4>
</div>
