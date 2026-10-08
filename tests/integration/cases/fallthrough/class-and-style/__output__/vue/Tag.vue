<script setup lang="ts">
const { label } = defineProps<{ label: string }>();
</script>

<template>
  <span class="tag" style="padding: 2px 6px; color: rgb(30, 30, 30)">{{ label }}</span>
</template>
