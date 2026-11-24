<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["ul"],
    "items" | "label" | "swatch" | "caption" | "children" | "class" | "style" | "ref"
  > & {
    items: string[];
    label: string;
    swatch?: Snippet<[{ item: string }]>;
    caption?: Snippet<[{ item: string }]>;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["ul"] | null;
  };

  let {
    items,
    label,
    swatch,
    caption,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<ul aria-label={label} class={className} {style} bind:this={ref} {...attributes}>
  {#each items as item (item)}
    <li>
      <span>{@render swatch?.({ item })}</span> <span>{@render caption?.({ item })}</span>
    </li>
  {/each}
</ul>
