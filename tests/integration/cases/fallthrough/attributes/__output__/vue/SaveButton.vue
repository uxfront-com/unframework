<script setup lang="ts">
const { title } = defineProps<{ title: string }>();
</script>

<template>
  <button type="button" class="button">{{ title }}</button>
</template>
