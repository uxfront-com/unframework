<script setup lang="ts">
import { vMark } from "./vMark";

export interface BadgeProps {
  label: string;
}

const { label } = defineProps<BadgeProps>();
</script>

<template>
  <span v-mark="'badge'" class="badge">{{ label }}</span>
</template>
