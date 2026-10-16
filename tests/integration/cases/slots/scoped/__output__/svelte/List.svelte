<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    items: string[];
    label: string;
    item?: Snippet<[{ item: string; index: number }]>;
    class?: ClassValue;
    style?: string;
  };

  let { items, label, item: itemSnippet, class: className, style }: Props = $props();
</script>

<ul aria-label={label} class={className} {style}>
  {#each items as item, index (item)}
    <li>{@render itemSnippet?.({ item, index })}</li>
  {/each}
</ul>
