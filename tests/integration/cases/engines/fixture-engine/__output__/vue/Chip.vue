<script setup lang="ts">
import { chip } from "virtual:fixture-engine";
import "virtual:fixture-engine.css";

const { label, tone = undefined } = defineProps<{ label: string; tone?: "plain" | "accent" }>();
</script>

<template>
  <span :class="chip(tone)">{{ label }}</span>
</template>
