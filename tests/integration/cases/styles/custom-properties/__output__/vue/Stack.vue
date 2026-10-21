<script setup lang="ts">
const { gap, accent } = defineProps<{ gap: string; accent: string }>();
</script>

<template>
  <ul class="stack" :style="{ '--gap': gap, '--accent': accent }" data-uf-e3a22111="">
    <li class="item" data-uf-e3a22111="">One</li>
    <li class="item" data-uf-e3a22111="">Two</li>
    <li class="item" data-uf-e3a22111="">Three</li>
  </ul>
</template>

<style src="./Stack.uf.tsx.css"></style>
