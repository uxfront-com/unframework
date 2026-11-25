<script setup lang="ts">
import Palette from "../../../../../integration/cases/types/shared-type/__output__/vue/Palette.vue";
import type { Tone } from "../../../../../integration/cases/types/shared-type/__output__/vue/Palette.vue";

// @uf-expect TS2322 Palette.type:Tone
const tone: Tone = "loud";
</script>

<template>
	<Palette :tone="tone" />
</template>
