<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export const ToneKey = Symbol("uf.tone") as symbol & { readonly __value: string };
</script>

<script lang="ts">
  import { getContext, hasContext } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  const tone = hasContext(ToneKey) ? getContext<(typeof ToneKey)["__value"]>(ToneKey) : "plain";

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<span class={["badge", className]} {style} {...scopeAttributes(attributes)}>Tone: {tone}</span>
