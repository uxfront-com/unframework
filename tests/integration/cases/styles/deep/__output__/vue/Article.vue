<script setup lang="ts">
import Note from "./Note.vue";

const { title, note } = defineProps<{ title: string; note: string }>();
</script>

<template>
  <article class="article" data-uf-15946226="">
    <h2 class="title" data-uf-15946226="">{{ title }}</h2>
    <Note :text="note" data-uf-15946226="" />
  </article>
</template>

<style src="./Article.uf.tsx.css"></style>
