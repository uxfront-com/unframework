<script setup lang="ts">
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

const {
  title,
  summary,
  minutes = 5,
  featured: _featured = undefined,
  category: _category = undefined,
  pinned: _pinned = false,
  layout: _layout = "row",
} = defineProps<ArticleTeaserProps>();
</script>

<template>
  <article class="article-teaser" :aria-label="title">
    <h2>{{ title }}</h2>
    <p>{{ summary }}</p>
    <p class="article-teaser-meta">{{ minutes }} min read</p>
  </article>
</template>
