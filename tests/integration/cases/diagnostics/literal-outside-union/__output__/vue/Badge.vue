<script setup lang="ts">
const { tone } = defineProps<{ tone: "info" | "warning" }>();
</script>

<template>
  <span class="badge" :class="tone">{{ tone }}</span>
</template>
