<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "virtual:styleframe.css";

  type Props = Omit<SvelteHTMLElements["p"], "text" | "children" | "class" | "style" | "ref"> & {
    text: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["p"] | null;
  };

  let { text, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<p
  class={["_padding:md _background-color:surface _color:text", className]}
  {style}
  bind:this={ref}
  {...attributes}
>{text}</p>
