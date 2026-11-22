<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Item from "./Item.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["ul"],
    "entries" | "children" | "class" | "style" | "ref"
  > & {
    entries: string[];
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["ul"] | null;
  };

  let { entries, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<ul aria-label="Menu" class={className} {style} bind:this={ref} {...attributes}>
  {#each entries as entry (entry)}
    <Item label={entry} />
  {/each}
</ul>
