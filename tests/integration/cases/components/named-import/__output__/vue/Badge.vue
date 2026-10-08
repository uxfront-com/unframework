<script setup lang="ts">
const { text } = defineProps<{ text: string }>();
</script>

<template>
  <span class="badge">{{ text }}</span>
</template>
