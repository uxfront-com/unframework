<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["ul"],
    "label" | "items" | "children" | "class" | "style" | "ref"
  > & {
    label: string;
    items: string[];
    children?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["ul"] | null;
  };

  let {
    label,
    items,
    children,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<ul class={["row-list", className]} aria-label={label} {style} bind:this={ref} {...attributes}>
  {#each items as item (item)}
    <li>{item} {@render children?.()}</li>
  {/each}
</ul>
