<script setup lang="ts">
const { step } = defineProps<{ step: string }>();
</script>

<template>
  <p class="step">Step: {{ step }}</p>
</template>
