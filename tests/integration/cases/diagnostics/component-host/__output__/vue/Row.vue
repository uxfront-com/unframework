<script setup lang="ts">
const { text } = defineProps<{ text: string }>();
</script>

<template>
  <div class="row">{{ text }}</div>
</template>
