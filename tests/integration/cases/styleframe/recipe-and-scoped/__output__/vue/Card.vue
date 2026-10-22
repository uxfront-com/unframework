<script setup lang="ts">
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";

const { title } = defineProps<{ title: string }>();
</script>

<template>
  <article class="card" :class="button({ size: 'lg', tone: 'primary' })" data-uf-9cfb6163="">
    <h2 class="title" data-uf-9cfb6163="">{{ title }}</h2>
  </article>
</template>

<style src="./Card.uf.tsx.css"></style>
