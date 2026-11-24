<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ExcerptProps {
    title: string;
    text: string;
    fill: string;
    stroke: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "title" | "text" | "fill" | "stroke" | "children" | "class" | "style" | "ref"
  > &
    ExcerptProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["article"] | null;
    };

  let {
    title,
    text,
    fill,
    stroke,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<article class={["excerpt", className]} {style} bind:this={ref} {...attributes}>
  <h2
    style:-webkit-text-fill-color={fill}
    style:-webkit-text-stroke-color={stroke}
    style:-webkit-text-stroke-width="1px"
    style:color="rgb(0, 0, 0)"
  >{title}</h2
  ><p
    style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; width: 240px"
  >{text}</p>
</article>
