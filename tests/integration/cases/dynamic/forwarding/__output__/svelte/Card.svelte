<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "title" | "children" | "class" | "style" | "ref"> & {
    title?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { title, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div class={["card", className]} {style} bind:this={ref} {...attributes}>
  <h3>
    {#if title}{@render title()}{:else}Untitled{/if}
  </h3>
</div>
