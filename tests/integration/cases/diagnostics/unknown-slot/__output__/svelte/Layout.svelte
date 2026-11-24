<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["main"],
    "title" | "children" | "class" | "style" | "ref"
  > & {
    title?: Snippet;
    children?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["main"] | null;
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

<main
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
><h1>{@render title?.()}</h1>{@render children?.()}</main>
