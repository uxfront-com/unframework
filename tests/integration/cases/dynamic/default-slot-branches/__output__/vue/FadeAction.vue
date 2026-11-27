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
    <Transition name="fade">
      <span>
        <slot>{{ label }}</slot>
      </span>
    </Transition>
  </component>
</template>
