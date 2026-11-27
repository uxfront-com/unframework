<script setup lang="ts">
import type { IntrinsicElementAttributes } from "vue";

const { href = undefined, label } = defineProps<
  { href?: string; label: string } & /* @vue-ignore */ Omit<
    IntrinsicElementAttributes["a"] & IntrinsicElementAttributes["button"],
    "href" | "label"
  >
>();
defineSlots<{ default?(): unknown; icon?(): unknown }>();
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="(href ? 'a' : 'button') === 'a' ? href : undefined"
    class="action"
  >
    <slot name="icon" />
    <span data-slot="label">
      <slot>{{ label }}</slot>
    </span>
  </component>
</template>
