<script setup lang="ts">
const { tag, text } = defineProps<{ tag: "h1" | "h2" | "h3"; text: string }>();
</script>

<template>
  <component :is="tag" class="heading">{{ text }}</component>
</template>
