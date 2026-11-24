<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ArticleTeaserProps {
    title: string;
    summary: string;
    author: string;
    minutes?: number;
    featured?: boolean;
    category?: string;
    pinned?: boolean;
    layout?: "row" | "column";
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["article"],
    | "title"
    | "summary"
    | "author"
    | "minutes"
    | "featured"
    | "category"
    | "pinned"
    | "layout"
    | "children"
    | "class"
    | "style"
    | "ref"
  > &
    ArticleTeaserProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["article"] | null;
    };

  let {
    title,
    summary,
    minutes = 5,
    pinned: _pinned,
    layout: _layout,
    author: _author,
    featured: _featured,
    category: _category,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<article
  class={["article-teaser", className]}
  aria-label={title}
  {style}
  bind:this={ref}
  {...attributes}
>
  <h2>{title}</h2
  ><p>{summary}</p
  ><p class="article-teaser-meta">{minutes} min read</p>
</article>
