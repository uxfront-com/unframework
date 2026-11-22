<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "label" | "children" | "class" | "style" | "ref"> & {
    label: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { label, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div class={["card", className]} {style} bind:this={ref} {...attributes}>
  <strong>{label}</strong>
</div>
