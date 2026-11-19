<script lang="ts">
export interface PickerProps<T> {
  items: T[];
}
</script>

<script setup vapor lang="ts" generic="T">
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
