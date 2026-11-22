<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { tag: "h1" | "h2" | "h3"; text: string; class?: ClassValue; style?: string };

  let { tag, text, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<svelte:element
  this={tag}
  class={["heading", className]}
  {style}
  {...scopeAttributes(attributes)}
>{text}</svelte:element>
