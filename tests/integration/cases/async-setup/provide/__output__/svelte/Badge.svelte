<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export const ToneKey = Symbol("uf.tone") as symbol & { readonly __value: string };
</script>

<script lang="ts">
  import { getContext, hasContext } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["span"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["span"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  const tone = hasContext(ToneKey) ? getContext<(typeof ToneKey)["__value"]>(ToneKey) : "plain";
</script>

<span class={["badge", className]} {style} bind:this={ref} {...attributes}>Tone: {tone}</span>
