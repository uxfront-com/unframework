<script setup lang="ts">
import Item from "./Item.vue";

const { entries } = defineProps<{ entries: string[] }>();
</script>

<template>
  <ul aria-label="Menu">
    <Item v-for="entry in entries" :key="entry" :label="entry" />
  </ul>
</template>
