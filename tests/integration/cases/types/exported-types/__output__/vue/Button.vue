<script setup lang="ts">
export type ButtonTone = "primary" | "secondary";

export type ButtonSize = "small" | "large";

export interface ButtonProps {
  label: string;
  tone?: ButtonTone;
}

const { label, tone = "primary" } = defineProps<ButtonProps>();
</script>

<template>
  <button type="button" :class="`button button-${tone}`">{{ label }}</button>
</template>
