<script setup lang="ts">
const { name } = defineProps<{ name: string }>();
</script>

<template>
  <span class="tag" data-uf-ef5e671c="">{{ name }}</span>
</template>

<style src="./Tag.uf.tsx.css"></style>
