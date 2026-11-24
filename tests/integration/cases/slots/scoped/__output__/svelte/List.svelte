<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["ul"],
    "items" | "label" | "item" | "children" | "class" | "style" | "ref"
  > & {
    items: string[];
    label: string;
    item?: Snippet<[{ item: string; index: number }]>;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["ul"] | null;
  };

  let {
    items,
    label,
    item: itemSnippet,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<ul aria-label={label} class={className} {style} bind:this={ref} {...attributes}>
  {#each items as item, index (item)}
    <li>{@render itemSnippet?.({ item, index })}</li>
  {/each}
</ul>
