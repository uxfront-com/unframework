<script setup lang="ts">
const { text, tone } = defineProps<{ text: string; tone: "info" | "quiet" }>();
</script>

<template>
  <p role="status" class="notice" :class="tone">{{ text }}</p>
</template>
