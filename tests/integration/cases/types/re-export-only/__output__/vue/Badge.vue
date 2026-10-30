<script setup lang="ts">
export type { Tone } from "./tone";

const { label } = defineProps<{ label: string }>();
</script>

<template>
  <span class="badge">{{ label }}</span>
</template>
