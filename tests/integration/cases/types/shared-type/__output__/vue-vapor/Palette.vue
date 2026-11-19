<script lang="ts">
import type { Tone } from "./types";

export type { Tone } from "./types";
</script>

<script setup vapor lang="ts">
import Swatch from "./Swatch.vue";

const { tone } = defineProps<{ tone: Tone }>();
</script>

<template>
  <div class="palette">
    <Swatch :tone="tone" />
  </div>
</template>
