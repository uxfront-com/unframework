<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Progress.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["div"], "label" | "children" | "class" | "style" | "ref"> & {
    label: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { label, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div class={["progress", className]} {style} data-uf-0738d8af="" bind:this={ref} {...attributes}>
  <span class="dot" data-uf-0738d8af=""></span><span data-uf-0738d8af="">{label}</span>
</div>
