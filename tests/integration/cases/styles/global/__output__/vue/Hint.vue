<script setup lang="ts">
const { text } = defineProps<{ text: string }>();
</script>

<template>
  <p class="hint">Tip: <span class="uf-highlight">{{ text }}</span></p>
</template>
