<script setup lang="ts">
import type { BadgeProps } from "./types";

const { label, tone = "info" } = defineProps<BadgeProps>();
</script>

<template>
  <span :class="`badge badge-${tone}`">{{ label }}</span>
</template>
