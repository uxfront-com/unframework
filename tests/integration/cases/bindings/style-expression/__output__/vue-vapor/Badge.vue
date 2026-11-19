<script lang="ts">
export interface BadgeProps {
  label: string;
  tone?: string;
}
</script>

<script setup vapor lang="ts">
const { label, tone = undefined } = defineProps<BadgeProps>();
</script>

<template>
  <span class="badge" :style="tone">{{ label }}</span>
</template>
