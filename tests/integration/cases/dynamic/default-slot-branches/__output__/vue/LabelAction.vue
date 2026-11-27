<script setup lang="ts">
import type { IntrinsicElementAttributes } from "vue";

const { href = undefined, label } = defineProps<
  { href?: string; label: string } & /* @vue-ignore */ Omit<
    IntrinsicElementAttributes["a"] & IntrinsicElementAttributes["button"],
    "href" | "label"
  >
>();
defineSlots<{ default?(): unknown }>();
</script>

<template>
  <component :is="href ? 'a' : 'button'" :href="(href ? 'a' : 'button') === 'a' ? href : undefined">
    <span v-if="label">
      <slot>{{ label }}</slot>
    </span>
  </component>
</template>
