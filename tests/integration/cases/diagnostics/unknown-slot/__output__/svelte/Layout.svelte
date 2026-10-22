<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { title?: Snippet; children?: Snippet; class?: ClassValue; style?: string };

  let { title, children, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<main
  class={className}
  {style}
  {...scopeAttributes(attributes)}
><h1>{@render title?.()}</h1>{@render children?.()}</main>
