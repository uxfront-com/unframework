<script setup lang="ts">
import Swatch from "./Swatch.vue";
import type { Tone } from "./types";

export type { Tone } from "./types";

const { tone } = defineProps<{ tone: Tone }>();
</script>

<template>
  <div class="palette">
    <Swatch :tone="tone" />
  </div>
</template>
