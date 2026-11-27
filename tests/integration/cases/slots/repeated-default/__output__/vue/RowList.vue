<script setup lang="ts">
const { label, items } = defineProps<{ label: string; items: string[] }>();
defineSlots<{ default?(): unknown }>();
</script>

<template>
  <ul class="row-list" :aria-label="label">
    <li v-for="item in items" :key="item">{{ item }} <slot /></li>
  </ul>
</template>
