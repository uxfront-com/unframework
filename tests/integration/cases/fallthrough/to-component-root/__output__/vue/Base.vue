<script setup lang="ts">
const { text } = defineProps<{ text: string }>();
</script>

<template>
  <button type="button" class="base">{{ text }}</button>
</template>
