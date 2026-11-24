<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "header" | "children" | "footer" | "class" | "style" | "ref"
  > & {
    header?: Snippet;
    children?: Snippet;
    footer?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["article"] | null;
  };

  let {
    header,
    children,
    footer,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<article class={["card", className]} {style} bind:this={ref} {...attributes}>
  <header>{@render header?.()}</header
  ><div class="body">{@render children?.()}</div
  ><footer>{@render footer?.()}</footer>
</article>
