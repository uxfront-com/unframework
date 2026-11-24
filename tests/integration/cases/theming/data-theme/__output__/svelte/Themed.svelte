<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "virtual:styleframe.css";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "text" | "dark" | "children" | "class" | "style" | "ref"
  > & {
    text: string;
    dark?: boolean;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let {
    text,
    dark = false,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section
  data-theme={dark ? "dark" : "light"}
  class={["_padding:md _background-color:surface _color:text", className]}
  {style}
  bind:this={ref}
  {...attributes}
>{text}</section>
