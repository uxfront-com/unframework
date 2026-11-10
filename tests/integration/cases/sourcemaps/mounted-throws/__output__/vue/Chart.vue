<script setup lang="ts">
import { onMounted } from "vue";

onMounted(() => {
  throw new Error("The chart could not start");
});
</script>

<template>
  <p>Chart</p>
</template>
