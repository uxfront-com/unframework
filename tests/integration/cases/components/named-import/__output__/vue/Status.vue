<script setup lang="ts">
import Badge from "./Badge.vue";
import Tag from "./Pill.vue";

const { state } = defineProps<{ state: string }>();
</script>

<template>
  <p class="status">
    <Badge text="Build" />
    <Tag :text="state" />
  </p>
</template>
