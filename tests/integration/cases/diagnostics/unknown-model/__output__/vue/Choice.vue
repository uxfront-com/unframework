<script setup lang="ts">
const picked = defineModel<string>("picked", { default: "" });
</script>

<template>
  <button type="button" @click="picked = 'yes'">Yes ({{ picked }})</button>
</template>
