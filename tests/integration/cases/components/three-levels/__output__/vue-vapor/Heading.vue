<script setup vapor lang="ts">
const { text } = defineProps<{ text: string }>();
</script>

<template>
  <h3 class="heading">{{ text }}</h3>
</template>
