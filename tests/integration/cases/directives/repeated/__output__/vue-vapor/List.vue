<script setup vapor lang="ts">
const { items } = defineProps<{ items: string[] }>();
defineSlots<{ item?(props: { item: string }): unknown }>();
</script>

<template>
  <ol>
    <li v-for="item in items" :key="item">
      <slot name="item" :item="item" />
    </li>
  </ol>
</template>
