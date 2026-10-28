<script setup lang="ts">
import type { Tone } from "./types";

const { tone } = defineProps<{ tone: Tone }>();
</script>

<template>
  <span :class="`swatch swatch-${tone}`">{{ tone }}</span>
</template>
