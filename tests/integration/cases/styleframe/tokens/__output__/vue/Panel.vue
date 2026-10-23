<script setup lang="ts">
import "virtual:styleframe.css";

const { text } = defineProps<{ text: string }>();
</script>

<template>
  <section class="panel" data-uf-b6be1fd3="">
    <p class="body" data-uf-b6be1fd3="">{{ text }}</p>
  </section>
</template>

<style src="./Panel.uf.tsx.css"></style>
