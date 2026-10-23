<script setup lang="ts">
const { text } = defineProps<{ text: string }>();
</script>

<template>
  <div class="note-box">
    <p class="note">{{ text }}</p>
  </div>
</template>
