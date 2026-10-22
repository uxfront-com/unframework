<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export const DepthKey = Symbol("uf.depth") as symbol & { readonly __value: number };
</script>

<script lang="ts">
  import { type Snippet, getContext, hasContext, setContext } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { title: string; children?: Snippet; class?: ClassValue; style?: string };

  let { title, children, class: className, style, ...attributes }: Props = $props();

  const depth = hasContext(DepthKey) ? getContext<(typeof DepthKey)["__value"]>(DepthKey) : 0;

  setContext(DepthKey, depth + 1);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  aria-label={title}
  class={className}
  {style}
  {...scopeAttributes(attributes)}
><h2>{title} at depth {depth}</h2>{@render children?.()}</section>
