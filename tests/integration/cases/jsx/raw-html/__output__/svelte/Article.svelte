<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ArticleProps {
    title: string;
    body: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "title" | "body" | "children" | "class" | "style" | "ref"
  > &
    ArticleProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["article"] | null;
    };

  let {
    title,
    body,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<article class={["article", className]} {style} bind:this={ref} {...attributes}>
  <h2>{title}</h2
  ><div class="body">{@html body}</div
  ><footer>{@html "<small>Filed under <em>News</em></small>"}</footer>
</article>
