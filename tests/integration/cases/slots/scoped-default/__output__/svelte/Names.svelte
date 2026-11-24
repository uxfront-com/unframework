<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["ul"], "names" | "children" | "class" | "style" | "ref"> & {
    names: string[];
    children?: Snippet<[{ item: string }]>;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["ul"] | null;
  };

  let {
    names,
    children,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<ul aria-label="Names" class={className} {style} bind:this={ref} {...attributes}>
  {#each names as item (item)}
    <li>{@render children?.({ item })}</li>
  {/each}
</ul>
