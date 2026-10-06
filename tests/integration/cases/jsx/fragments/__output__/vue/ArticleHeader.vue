<script setup lang="ts">
export interface ArticleHeaderProps {
  title: string;
  subtitle?: string;
  draft: boolean;
  tags: string[];
}

const { title, subtitle = undefined, draft, tags } = defineProps<ArticleHeaderProps>();
</script>

<template>
  <h2>{{ title }}</h2>
  <p v-if="subtitle" class="article-subtitle">{{ subtitle }}</p>
  <template v-if="draft">
    <p class="article-badge">Draft</p>
    <p>Only editors can see this article.</p>
  </template>
  <template v-else>
    <p class="article-badge">Published</p>
    <p>Everyone can read this article.</p>
  </template>
  <p>Tagged {{ tags.join(", ") }}</p>
</template>
