<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface ArticleSkeletonProps {
    title: string;
    summary?: string;
    minutes?: number;
  }

  type Props = ArticleSkeletonProps & { class?: ClassValue; style?: string };

  let { class: className, style }: Props = $props();
</script>

<article
  class={["article-skeleton", className]}
  aria-busy="true"
  aria-label="Loading article"
  {style}
>
  <p>Loading the article</p>
</article>
