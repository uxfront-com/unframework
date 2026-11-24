<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Card.uf.tsx.css";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "title" | "children" | "class" | "style" | "ref"
  > & {
    title: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { title, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<section class={["card", className]} {style} data-uf-bb60e985="" bind:this={ref} {...attributes}>
  <h2 class="title" data-uf-bb60e985="">{title}</h2>
</section>
