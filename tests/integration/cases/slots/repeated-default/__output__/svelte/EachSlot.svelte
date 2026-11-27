<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["span"],
    "items" | "row" | "children" | "class" | "style" | "ref"
  > & {
    items: string[];
    row?: Snippet<[{ item: string }]>;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["span"] | null;
  };

  let {
    items,
    row,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<span class={["each-slot", className]} {style} bind:this={ref} {...attributes}>
  {#each items as item (item)}
    <span class="each-row">{@render row?.({ item })}</span>
  {/each}
</span>
