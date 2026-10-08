<script setup lang="ts">
const { text } = defineProps<{ text: string }>();
</script>

<template>
  <small class="hint">{{ text }}</small>
</template>
