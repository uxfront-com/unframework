<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ArticleSkeletonProps {
    title: string;
    summary?: string;
    minutes?: number;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    "title" | "summary" | "minutes" | "children" | "class" | "style" | "ref"
  > &
    ArticleSkeletonProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["article"] | null;
    };

  let { class: className, style, ref = $bindable(null), ..._props }: Props = $props();

  let { title: _title, summary: _summary, minutes: _minutes, ...attributes } = $derived(_props);
</script>

<article
  class={["article-skeleton", className]}
  aria-busy="true"
  aria-label="Loading article"
  {style}
  bind:this={ref}
  {...attributes}
>
  <p>Loading the article</p>
</article>
