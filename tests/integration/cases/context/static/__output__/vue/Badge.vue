<script setup lang="ts">
import { ThemeKey } from "./ThemeProvider.vue";
import { inject } from "vue";

const { text } = defineProps<{ text: string }>();

const theme = inject(ThemeKey);
</script>

<template>
  <span class="badge" :class="theme?.accent">{{ text }} in {{ theme?.label ?? "no theme" }}</span>
</template>
