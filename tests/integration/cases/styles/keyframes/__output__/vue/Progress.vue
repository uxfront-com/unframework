<script setup lang="ts">
const { label } = defineProps<{ label: string }>();
</script>

<template>
  <div class="progress" data-uf-0738d8af="">
    <span class="dot" data-uf-0738d8af=""></span>
    <span data-uf-0738d8af="">{{ label }}</span>
  </div>
</template>

<style src="./Progress.uf.tsx.css"></style>
