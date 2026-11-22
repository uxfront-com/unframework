<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Blue.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["div"], "children" | "class" | "style" | "ref"> & {
    children?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { children, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div
  class={["blue", className]}
  {style}
  data-uf-721c504a=""
  bind:this={ref}
  {...attributes}
>{@render children?.()}</div>
