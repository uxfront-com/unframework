<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

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

  type Props = ArticleTeaserProps & { class?: ClassValue; style?: string };

  let { title, summary, minutes = 5, class: className, style }: Props = $props();
</script>

<article class={["article-teaser", className]} aria-label={title} {style}>
  <h2>{title}</h2
  ><p>{summary}</p
  ><p class="article-teaser-meta">{minutes} min read</p>
</article>
