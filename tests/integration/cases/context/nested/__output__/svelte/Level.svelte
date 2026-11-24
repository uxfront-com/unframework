<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export const DepthKey = Symbol("uf.depth") as symbol & { readonly __value: number };
</script>

<script lang="ts">
  import { type Snippet, getContext, hasContext, setContext } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "title" | "children" | "class" | "style" | "ref"
  > & {
    title: string;
    children?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let {
    title,
    children,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  const depth = hasContext(DepthKey) ? getContext<(typeof DepthKey)["__value"]>(DepthKey) : 0;

  setContext(DepthKey, depth + 1);
</script>

<section
  aria-label={title}
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
><h2>{title} at depth {depth}</h2>{@render children?.()}</section>
