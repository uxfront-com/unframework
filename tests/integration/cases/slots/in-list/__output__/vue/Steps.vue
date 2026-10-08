<script setup lang="ts">
const { steps } = defineProps<{ steps: string[] }>();
defineSlots<{ marker?(): unknown }>();
</script>

<template>
  <ol class="steps">
    <li v-for="step in steps" :key="step"><slot name="marker" />{{ step }}</li>
  </ol>
</template>
