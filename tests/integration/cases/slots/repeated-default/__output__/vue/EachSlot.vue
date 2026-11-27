<script setup lang="ts">
const { items } = defineProps<{ items: string[] }>();
defineSlots<{ row?(props: { item: string }): unknown }>();
</script>

<template>
  <span class="each-slot">
    <span v-for="item in items" :key="item" class="each-row">
      <slot name="row" :item="item" />
    </span>
  </span>
</template>
