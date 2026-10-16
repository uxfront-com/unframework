<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Item from "./Item.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { entries: string[]; class?: ClassValue; style?: string };

  let { entries, class: className, style }: Props = $props();
</script>

<ul aria-label="Menu" class={className} {style}>
  {#each entries as entry (entry)}
    <Item label={entry} />
  {/each}
</ul>
