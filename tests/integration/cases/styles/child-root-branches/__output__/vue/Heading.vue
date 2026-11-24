<script setup lang="ts">
import type { IntrinsicElementAttributes } from "vue";

const { big, text } = defineProps<
  { big: boolean; text: string } & /* @vue-ignore */ Omit<
    IntrinsicElementAttributes["h2"] & IntrinsicElementAttributes["h3"],
    "big" | "text"
  >
>();
</script>

<template>
  <component :is="big ? 'h2' : 'h3'" class="heading">{{ text }}</component>
</template>
