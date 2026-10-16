<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    names: string[];
    children?: Snippet<[{ item: string }]>;
    class?: ClassValue;
    style?: string;
  };

  let { names, children, class: className, style }: Props = $props();
</script>

<ul aria-label="Names" class={className} {style}>
  {#each names as item (item)}
    <li>{@render children?.({ item })}</li>
  {/each}
</ul>
