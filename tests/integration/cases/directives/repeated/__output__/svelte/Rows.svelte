<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "row" | "children" | "class" | "style" | "ref"> & {
    row?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { row, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let items = $state.raw([1, 2]);
</script>

<div class={["rows", className]} {style} bind:this={ref} {...attributes}>
  <ul>
    {#each items as item (item)}
      <li>{@render row?.()}</li>
    {/each}
  </ul
  ><button type="button" onclick={() => (items = [...items, items.length + 1])}>Add row</button
  ><button type="button" onclick={() => (items = items.slice(0, -1))}>Remove row</button>
</div>
