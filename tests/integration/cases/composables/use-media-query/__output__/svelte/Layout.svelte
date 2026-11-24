<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useMediaQuery } from "./useMediaQuery.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  const wide = useMediaQuery("(min-width: 1px)");
  const tiny = useMediaQuery("(max-width: 1px)");
</script>

<section class={["layout", className]} aria-label="Layout" {style} bind:this={ref} {...attributes}>
  <p role="status">{wide.matches ? "Wide layout" : "Narrow layout"}</p
  ><p>{tiny.matches ? "Tiny screen" : "Not a tiny screen"}</p>
</section>
