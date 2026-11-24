<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  import type { Tone } from "./types";

  export type { Tone } from "./types";
</script>

<script lang="ts">
  import Swatch from "./Swatch.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "tone" | "children" | "class" | "style" | "ref"> & {
    tone: Tone;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { tone, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div class={["palette", className]} {style} bind:this={ref} {...attributes}>
  <Swatch {tone} />
</div>
