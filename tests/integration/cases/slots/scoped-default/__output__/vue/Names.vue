<script setup lang="ts">
const { names } = defineProps<{ names: string[] }>();
defineSlots<{ default?(props: { item: string }): unknown }>();
</script>

<template>
  <ul aria-label="Names">
    <li v-for="item in names" :key="item">
      <slot :item="item" />
    </li>
  </ul>
</template>
