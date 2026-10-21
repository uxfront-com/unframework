<script setup lang="ts">
const { text } = defineProps<{ text: string }>();
</script>

<template>
  <button type="button" class="action" data-uf-6173c12c="">{{ text }}</button>
</template>

<style src="./Action.uf.tsx.css"></style>
