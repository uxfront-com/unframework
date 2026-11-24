<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["span"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["span"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<span class={className} {style} bind:this={ref} {...attributes}>Item</span>
