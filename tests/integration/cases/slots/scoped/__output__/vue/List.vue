<script setup lang="ts">
const { items, label } = defineProps<{ items: string[]; label: string }>();
defineSlots<{ item?(props: { item: string; index: number }): unknown }>();
</script>

<template>
  <ul :aria-label="label">
    <li v-for="(item, index) in items" :key="item">
      <slot name="item" :item="item" :index="index" />
    </li>
  </ul>
</template>
