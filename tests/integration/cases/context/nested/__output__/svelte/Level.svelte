<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export type DepthKeyValue = number;
  export const DepthKey = Symbol("uf.depth");
</script>

<script lang="ts">
  import { type Snippet, getContext, hasContext, setContext } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { title: string; children?: Snippet; class?: ClassValue; style?: string };

  let { title, children, class: className, style }: Props = $props();

  const depth = hasContext(DepthKey) ? getContext<DepthKeyValue>(DepthKey) : 0;

  setContext(DepthKey, depth + 1);
</script>

<section
  aria-label={title}
  class={className}
  {style}
><h2>{title} at depth {depth}</h2>{@render children?.()}</section>
