<script lang="ts">
export type ButtonTone = "primary" | "secondary";

export type ButtonSize = "small" | "large";

export interface ButtonProps {
  label: string;
  tone?: ButtonTone;
}
</script>

<script setup vapor lang="ts">
const { label, tone = "primary" } = defineProps<ButtonProps>();
</script>

<template>
  <button type="button" :class="`button button-${tone}`">{{ label }}</button>
</template>
