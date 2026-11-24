<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import { button } from "virtual:styleframe";
  import "virtual:styleframe.css";
  import "./Card.uf.tsx.css";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "title" | "children" | "class" | "style" | "ref"
  > & {
    title: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["article"] | null;
  };

  let { title, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<article
  class={["card", button({ size: "lg", tone: "primary" }), className]}
  {style}
  data-uf-9cfb6163=""
  bind:this={ref}
  {...attributes}
>
  <h2 class="title" data-uf-9cfb6163="">{title}</h2>
</article>
