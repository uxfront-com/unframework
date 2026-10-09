<script setup lang="ts">
const { label } = defineProps<{ label: string }>();
</script>

<template>
  <div class="card">
    <strong>{{ label }}</strong>
  </div>
</template>
