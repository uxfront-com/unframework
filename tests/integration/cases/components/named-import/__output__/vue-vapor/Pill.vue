<script setup vapor lang="ts">
const { text } = defineProps<{ text: string }>();
</script>

<template>
  <span class="pill">{{ text }}</span>
</template>
