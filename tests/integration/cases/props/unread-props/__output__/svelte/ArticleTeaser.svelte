<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
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

  let { title, summary, minutes = 5 }: ArticleTeaserProps = $props();
</script>

<article class="article-teaser" aria-label={title}>
  <h2>{title}</h2
  ><p>{summary}</p
  ><p class="article-teaser-meta">{minutes} min read</p>
</article>
