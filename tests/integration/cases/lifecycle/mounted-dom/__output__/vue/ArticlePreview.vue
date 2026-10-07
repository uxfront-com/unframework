<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from "vue";

export interface ArticlePreviewProps {
  title: string;
  text: string;
}

const { title, text } = defineProps<ArticlePreviewProps>();
const emit = defineEmits<{ ready: [characters: number] }>();

const body = useTemplateRef<HTMLParagraphElement>("body");
const characters = ref(0);
const counted = ref(false);

onMounted(() => {
  const length = body.value?.textContent?.length ?? 0;
  characters.value = length;
  counted.value = true;
  emit("ready", length);
});
</script>

<template>
  <article class="article-preview" :aria-label="title">
    <h2>{{ title }}</h2>
    <p ref="body">{{ text }}</p>
    <p role="status">{{ counted ? `${characters} characters` : "Counting the characters" }}</p>
  </article>
</template>
