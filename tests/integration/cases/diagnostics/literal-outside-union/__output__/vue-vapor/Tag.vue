<script lang="ts">
export type Tone = "info" | "warning";
</script>

<script setup vapor lang="ts">
const { tone } = defineProps<{ tone: Tone }>();
</script>

<template>
  <span class="tag" :class="tone">{{ tone }}</span>
</template>
