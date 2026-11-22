<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Picker from "./Picker.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  interface Fruit {
    name: string;
    count: number;
  }

  type Props = Omit<
    SvelteHTMLElements["ul"],
    "fruits" | "children" | "class" | "style" | "ref" | "items" | "item"
  > & {
    fruits: Fruit[];
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["ul"] | null;
  };

  let { fruits, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<Picker items={fruits} class={className} {style} bind:ref {...attributes}>
  {#snippet item({ item })}
    <span>{item.name} × {item.count}</span>
  {/snippet}
</Picker>
