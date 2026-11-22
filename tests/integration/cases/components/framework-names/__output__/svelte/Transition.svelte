<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["p"], "step" | "children" | "class" | "style" | "ref"> & {
    step: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["p"] | null;
  };

  let { step, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<p class={["step", className]} {style} bind:this={ref} {...attributes}>Step: {step}</p>
