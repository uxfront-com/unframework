<script setup lang="ts">
import type { Sized, Toned } from "./types";

type ChipProps = Sized & Toned & { label: string };

const { size, tone = "neutral", label } = defineProps<ChipProps>();
</script>

<template>
  <span :class="`chip chip-${size} chip-${tone}`">{{ label }}</span>
</template>
