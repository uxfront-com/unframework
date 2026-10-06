<script setup lang="ts">
export interface CommentQuoteProps {
  author: string;
  comment: string;
}

const { author, comment } = defineProps<CommentQuoteProps>();
</script>

<template>
  <figure class="comment-quote">
    <blockquote style="margin: 0; padding: 0">
      <p dir="auto">{{ comment }}</p>
    </blockquote>
    <figcaption>{{ author }}</figcaption>
  </figure>
</template>
