<script lang="ts">
export interface BadgeProps {
  label: string;
}
</script>

<script setup vapor lang="ts">
import { vMark } from "./vMark";

const { label } = defineProps<BadgeProps>();
</script>

<template>
  <span v-mark="'badge'" class="badge">{{ label }}</span>
</template>
