<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["p"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["p"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  onMount(() => {
    throw new Error("The chart could not start");
  });
</script>

<p class={className} {style} bind:this={ref} {...attributes}>Chart</p>
