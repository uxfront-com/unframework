<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface ArticleSkeletonProps {
    title: string;
    summary?: string;
    minutes?: number;
  }

  let _props: ArticleSkeletonProps = $props();
</script>

<article class="article-skeleton" aria-busy="true" aria-label="Loading article">
  <p>Loading the article</p>
</article>
