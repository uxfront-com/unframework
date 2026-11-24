<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, DOMAttributes, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["h1"] & SvelteHTMLElements["h2"] & SvelteHTMLElements["h3"],
    | "tag"
    | "text"
    | "children"
    | "class"
    | "style"
    | "ref"
    | keyof DOMAttributes<HTMLElementTagNameMap["h1" | "h2" | "h3"]>
  > &
    Omit<DOMAttributes<HTMLElementTagNameMap["h1" | "h2" | "h3"]>, "children"> & {
      tag: "h1" | "h2" | "h3";
      text: string;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["h1" | "h2" | "h3"] | null;
    };

  let {
    tag,
    text,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<svelte:element
  this={tag}
  class={["heading", className]}
  {style}
  bind:this={ref}
  {...attributes}
>{text}</svelte:element>
