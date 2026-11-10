<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Tone } from "./types";
  import type { ClassValue } from "svelte/elements";

  type Props = { tone: Tone; class?: ClassValue; style?: string };

  let { tone, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<span
  class={[`swatch swatch-${tone}`, className]}
  {style}
  {...scopeAttributes(attributes)}
>{tone}</span>
