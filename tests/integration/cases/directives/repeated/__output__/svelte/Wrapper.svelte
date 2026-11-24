<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Rows from "./Rows.svelte";
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "row" | "children" | "class" | "style" | "ref"
  > & {
    row?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { row, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<section class={["wrapper", className]} aria-label="Rows" {style} bind:this={ref} {...attributes}>
  <Rows {row} />
</section>
