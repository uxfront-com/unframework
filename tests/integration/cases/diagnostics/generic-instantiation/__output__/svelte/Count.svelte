<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  interface Fruit {
    id: string;
    name: string;
    children: Fruit[];
  }

  type Props = Omit<SvelteHTMLElements["p"], "items" | "children" | "class" | "style" | "ref"> & {
    items: Fruit[];
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["p"] | null;
  };

  let { items, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<p class={className} {style} bind:this={ref} {...attributes}>{items.length} fruits</p>
