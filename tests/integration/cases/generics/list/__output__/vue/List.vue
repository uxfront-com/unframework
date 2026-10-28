<script setup lang="ts" generic="T">
export interface ListProps<T> {
  label: string;
  items: T[];
  selected?: T;
}

const { label, items, selected = undefined } = defineProps<ListProps<T>>();
</script>

<template>
  <ul :aria-label="label">
    <li
      v-for="(item, index) in items"
      :key="index"
      :aria-current="item === selected ? 'true' : undefined"
    >{{ String(item) }}</li>
  </ul>
</template>
