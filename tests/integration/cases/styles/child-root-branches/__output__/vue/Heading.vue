<script setup lang="ts">
const { big, text } = defineProps<{ big: boolean; text: string }>();
</script>

<template>
  <component :is="big ? 'h2' : 'h3'" class="heading">{{ text }}</component>
</template>
