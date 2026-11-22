<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "heading" | "children" | "class" | "style" | "ref"
  > & {
    heading: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { heading, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<section class={["card", className]} {style} bind:this={ref} {...attributes}>
  <h2>{heading}</h2>
</section>
