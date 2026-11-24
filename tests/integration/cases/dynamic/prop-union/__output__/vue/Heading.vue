<script setup lang="ts">
import type { IntrinsicElementAttributes } from "vue";

const { tag, text } = defineProps<
  { tag: "h1" | "h2" | "h3"; text: string } & /* @vue-ignore */ Omit<
    IntrinsicElementAttributes["h1"] &
      IntrinsicElementAttributes["h2"] &
      IntrinsicElementAttributes["h3"],
    "tag" | "text"
  >
>();
</script>

<template>
  <component :is="tag" class="heading">{{ text }}</component>
</template>
