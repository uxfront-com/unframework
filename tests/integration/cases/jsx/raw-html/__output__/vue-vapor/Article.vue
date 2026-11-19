<script lang="ts">
export interface ArticleProps {
  title: string;
  body: string;
}
</script>

<script setup vapor lang="ts">
const { title, body } = defineProps<ArticleProps>();
</script>

<template>
  <article class="article">
    <h2>{{ title }}</h2>
    <div class="body" v-html="body"></div>
    <footer v-html="'<small>Filed under <em>News</em></small>'"></footer>
  </article>
</template>
