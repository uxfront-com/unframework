<script setup lang="ts">
export interface BadgeProps {
  label: string;
  tone?: string;
}

const { label, tone = undefined } = defineProps<BadgeProps>();
</script>

<template>
  <span class="badge" :style="tone">{{ label }}</span>
</template>
