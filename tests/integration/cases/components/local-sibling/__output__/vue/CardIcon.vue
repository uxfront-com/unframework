<script setup lang="ts">
const { symbol } = defineProps<{ symbol: string }>();
</script>

<template>
  <span class="icon" aria-hidden="true">{{ symbol }}</span>
</template>
