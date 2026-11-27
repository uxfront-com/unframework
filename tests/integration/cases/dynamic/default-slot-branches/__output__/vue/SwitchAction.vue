<script setup lang="ts">
import type { IntrinsicElementAttributes } from "vue";

const { href = undefined } = defineProps<
  { href?: string } & /* @vue-ignore */ Omit<
    IntrinsicElementAttributes["a"] & IntrinsicElementAttributes["button"],
    "href"
  >
>();
defineSlots<{ default?(): unknown }>();
</script>

<template>
  <component :is="href ? 'a' : 'button'" :href="(href ? 'a' : 'button') === 'a' ? href : undefined">
    <b v-if="href">
      <slot />
    </b>
    <i v-else>
      <slot />
    </i>
  </component>
</template>
