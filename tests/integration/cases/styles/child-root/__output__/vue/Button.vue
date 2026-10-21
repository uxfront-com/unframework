<script setup lang="ts">
const { text } = defineProps<{ text: string }>();
</script>

<template>
  <button
    type="button"
    class="button"
  ><span class="icon" aria-hidden="true">+</span>{{ text }}</button>
</template>
