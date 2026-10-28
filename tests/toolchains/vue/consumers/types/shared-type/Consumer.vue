<script setup lang="ts">
import Palette, {
  type Tone,
} from "../../../../../integration/cases/types/shared-type/__output__/vue/Palette.vue";

const tone: Tone = "accent";
</script>

<template>
  <Palette :tone="tone" />
</template>
