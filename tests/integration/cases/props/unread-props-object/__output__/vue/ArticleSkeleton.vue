<script setup lang="ts">
export interface ArticleSkeletonProps {
  title: string;
  summary?: string;
  minutes?: number;
}

defineProps<ArticleSkeletonProps>();
</script>

<template>
  <article class="article-skeleton" aria-busy="true" aria-label="Loading article">
    <p>Loading the article</p>
  </article>
</template>
