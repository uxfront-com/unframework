<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Amber.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["div"], "children" | "class" | "style" | "ref"> & {
    children?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { children, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div
  class={["amber", className]}
  {style}
  data-uf-c97301b3=""
  bind:this={ref}
  {...attributes}
>{@render children?.()}</div>
