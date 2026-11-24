<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, DOMAttributes, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["h2"] & SvelteHTMLElements["h3"],
    | "big"
    | "text"
    | "children"
    | "class"
    | "style"
    | "ref"
    | keyof DOMAttributes<HTMLElementTagNameMap["h2" | "h3"]>
  > &
    Omit<DOMAttributes<HTMLElementTagNameMap["h2" | "h3"]>, "children"> & {
      big: boolean;
      text: string;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["h2" | "h3"] | null;
    };

  let {
    big,
    text,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<svelte:element
  this={big ? "h2" : "h3"}
  class={["heading", className]}
  {style}
  bind:this={ref}
  {...attributes}
>{text}</svelte:element>
