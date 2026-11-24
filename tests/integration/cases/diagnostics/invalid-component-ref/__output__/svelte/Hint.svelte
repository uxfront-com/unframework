<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["small"],
    "text" | "children" | "class" | "style" | "ref"
  > & {
    text: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["small"] | null;
  };

  let { text, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<small class={["hint", className]} {style} bind:this={ref} {...attributes}>{text}</small>
