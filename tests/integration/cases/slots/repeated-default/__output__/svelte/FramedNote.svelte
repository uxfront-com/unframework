<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "title" | "children" | "class" | "style" | "ref"
  > & {
    title: string;
    children?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["article"] | null;
  };

  let {
    title,
    children,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<article class={["framed-note", className]} {style} bind:this={ref} {...attributes}>
  <header>{@render children?.()}</header
  ><p>{title}</p
  ><footer>{@render children?.()}</footer>
</article>
