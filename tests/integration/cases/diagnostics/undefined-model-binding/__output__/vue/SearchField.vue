<script setup lang="ts">
const query = defineModel<string | undefined>("query", { default: undefined });
</script>

<template>
  <input v-model="query" type="search" aria-label="Search" />
</template>
