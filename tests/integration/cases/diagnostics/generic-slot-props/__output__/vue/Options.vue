<script setup lang="ts" generic="T extends { value: string }">
const { options } = defineProps<{ options: T[] }>();
defineSlots<{ option?(props: { option: T }): unknown }>();
</script>

<template>
  <ul>
    <li v-for="option in options" :key="option.value">
      <slot name="option" :option="option" />
    </li>
  </ul>
</template>
