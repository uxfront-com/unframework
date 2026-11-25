<script setup lang="ts">
import Palette from "../../../../../integration/cases/types/shared-type/__output__/vue/Palette.vue";
import type { Tone } from "../../../../../integration/cases/types/shared-type/__output__/vue/Palette.vue";

const tone: Tone = "accent";
</script>

<template>
	<Palette :tone="tone" />
</template>
