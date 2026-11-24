<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface PickerProps<T> {
    items: T[];
  }
</script>

<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["ul"],
    "items" | "item" | "children" | "class" | "style" | "ref"
  > &
    PickerProps<T> & {
      item?: Snippet<[{ item: T }]>;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["ul"] | null;
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

<ul class={className} {style} bind:this={ref} {...attributes}>
  {#each items as item, index (index)}
    <li>{@render itemSnippet?.({ item })}</li>
  {/each}
</ul>
