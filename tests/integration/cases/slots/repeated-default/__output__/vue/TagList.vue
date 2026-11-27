<script setup lang="ts">
import type { IntrinsicElementAttributes } from "vue";

const { ordered, label, items } = defineProps<
  { ordered: boolean; label: string; items: string[] } & /* @vue-ignore */ Omit<
    IntrinsicElementAttributes["ol"] & IntrinsicElementAttributes["ul"],
    "ordered" | "label" | "items"
  >
>();
defineSlots<{ default?(): unknown }>();
</script>

<template>
  <component :is="ordered ? 'ol' : 'ul'" class="tag-list" :aria-label="label">
    <li v-for="item in items" :key="item">
      <slot>{{ item }}</slot>
    </li>
  </component>
</template>
