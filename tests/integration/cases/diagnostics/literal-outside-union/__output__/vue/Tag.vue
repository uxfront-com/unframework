<script setup lang="ts">
export type Tone = "info" | "warning";

const { tone } = defineProps<{ tone: Tone }>();
</script>

<template>
  <span class="tag" :class="tone">{{ tone }}</span>
</template>
