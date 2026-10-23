<script setup lang="ts">
const { label, count } = defineProps<{ label: string; count: number }>();
</script>

<template>
  <span class="badge" data-uf-d9cef2e7="">
    <span class="label" data-uf-d9cef2e7="">{{ label }}</span>
    <span class="count" data-uf-d9cef2e7="">{{ count }}</span>
  </span>
</template>

<style src="./Badge.uf.tsx.css"></style>
