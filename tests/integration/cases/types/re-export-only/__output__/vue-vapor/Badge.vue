<script lang="ts">
export type { Tone } from "./tone";
</script>

<script setup vapor lang="ts">
const { label } = defineProps<{ label: string }>();
</script>

<template>
  <span class="badge">{{ label }}</span>
</template>
