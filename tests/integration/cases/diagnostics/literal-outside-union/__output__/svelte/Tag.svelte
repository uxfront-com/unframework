<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export type Tone = "info" | "warning";
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["span"], "tone" | "children" | "class" | "style" | "ref"> & {
    tone: Tone;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["span"] | null;
  };

  let { tone, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<span class={["tag", tone, className]} {style} bind:this={ref} {...attributes}>{tone}</span>
