<script setup lang="ts">
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";

const {
  label,
  size = undefined,
  tone = undefined,
} = defineProps<{ label: string; size?: "sm" | "lg"; tone?: "neutral" | "primary" }>();
</script>

<template>
  <button type="button" :class="button({ size, tone })">{{ label }}</button>
</template>
