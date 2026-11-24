<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["span"],
    "label" | "children" | "class" | "style" | "ref"
  > & {
    label: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["span"] | null;
  };

  let { label, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<span class={["chip", className]} {style} bind:this={ref} {...attributes}>{label}</span>
