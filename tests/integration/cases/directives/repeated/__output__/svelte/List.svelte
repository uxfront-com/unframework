<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, HTMLOlAttributes } from "svelte/elements";

  type Props = Omit<HTMLOlAttributes, "items" | "item" | "children" | "class" | "style" | "ref"> & {
    items: string[];
    item?: Snippet<[{ item: string }]>;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["ol"] | null;
  };

  let {
    items,
    item: itemSnippet,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<ol class={className} {style} bind:this={ref} {...attributes}>
  {#each items as item (item)}
    <li>{@render itemSnippet?.({ item })}</li>
  {/each}
</ol>
