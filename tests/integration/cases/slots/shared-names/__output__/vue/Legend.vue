<script setup lang="ts">
const { items, label } = defineProps<{ items: string[]; label: string }>();
defineSlots<{
  swatch?(props: { item: string }): unknown;
  caption?(props: { item: string }): unknown;
}>();
</script>

<template>
  <ul :aria-label="label">
    <li v-for="item in items" :key="item">
      <span><slot name="swatch" :item="item" /></span> <span><slot name="caption" :item="item" /></span>
    </li>
  </ul>
</template>
