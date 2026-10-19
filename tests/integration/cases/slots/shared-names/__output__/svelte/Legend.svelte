<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    items: string[];
    label: string;
    swatch?: Snippet<[{ item: string }]>;
    caption?: Snippet<[{ item: string }]>;
    class?: ClassValue;
    style?: string;
  };

  let { items, label, swatch, caption, class: className, style }: Props = $props();
</script>

<ul aria-label={label} class={className} {style}>
  {#each items as item (item)}
    <li>
      <span>{@render swatch?.({ item })}</span> <span>{@render caption?.({ item })}</span>
    </li>
  {/each}
</ul>
