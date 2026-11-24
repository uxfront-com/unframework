<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Frame.uf.tsx.css";

  type Props = Omit<
    SvelteHTMLElements["figure"],
    "children" | "label" | "class" | "style" | "ref"
  > & {
    children?: Snippet;
    label?: Snippet<[{ text: string }]>;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["figure"] | null;
  };

  let {
    children,
    label,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<figure
  class={["frame", className]}
  {style}
  data-uf-9dc516fd=""
  bind:this={ref}
  {...attributes}
>{@render children?.()}{@render label?.({ text: "Harbour at dusk" })}</figure>
