<script setup lang="ts">
const { label } = defineProps<{ label: string }>();
</script>

<template>
  <li class="item">{{ label }}</li>
</template>
