<script setup lang="ts">
const { label } = defineProps<{ label: string }>();
</script>

<template>
  <label>{{ label }} <input type="text" /></label>
</template>
