<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "virtual:styleframe.css";

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

<span
  class={["_padding:lg _background-color:primary _color:on-primary _border-radius:[4px]", className]}
  {style}
  bind:this={ref}
  {...attributes}
>{label}</span>
