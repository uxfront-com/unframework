<script setup lang="ts">
import { badge } from "virtual:styleframe";
import "virtual:styleframe.css";

const { label } = defineProps<{ label: string }>();
</script>

<template>
  <span :class="badge()">{{ label }}</span>
</template>
