<script setup lang="ts" generic="T">
export interface PickerProps<T> {
  items: T[];
}

const { items } = defineProps<PickerProps<T>>();
defineSlots<{ item?(props: { item: T }): unknown }>();
</script>

<template>
  <ul>
    <li v-for="(item, index) in items" :key="index">
      <slot name="item" :item="item" />
    </li>
  </ul>
</template>
