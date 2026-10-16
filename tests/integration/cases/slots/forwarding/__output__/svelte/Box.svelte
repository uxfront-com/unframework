<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { title?: Snippet; children?: Snippet; class?: ClassValue; style?: string };

  let { title, children, class: className, style }: Props = $props();
</script>

<div class={["box", className]} {style}>
  <h3>
    {#if title}{@render title()}{:else}Untitled{/if}
  </h3
  >{#if children}{@render children()}{:else}<p>No content</p>{/if}
</div>
