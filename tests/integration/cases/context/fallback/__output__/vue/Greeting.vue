<script setup lang="ts">
import { LocaleKey } from "./LocaleProvider.vue";
import { inject } from "vue";

const { name } = defineProps<{ name: string }>();

const locale = inject(LocaleKey, "en");
</script>

<template>
  <p>{{ locale === "pt" ? "Olá" : "Hello" }}, {{ name }} ({{ locale }})</p>
</template>
