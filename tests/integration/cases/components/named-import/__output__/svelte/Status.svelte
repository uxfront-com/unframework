<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Badge from "./Badge.svelte";
  import Tag from "./Pill.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["p"], "state" | "children" | "class" | "style" | "ref"> & {
    state: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["p"] | null;
  };

  let { state, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<p class={["status", className]} {style} bind:this={ref} {...attributes}>
  <Badge text="Build" /><Tag text={state} />
</p>
