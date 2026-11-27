<script setup lang="ts">
const { label } = defineProps<{ label: string }>();
defineSlots<{ text?(props: { label: string }): unknown }>();
</script>

<template>
  <span class="once-slot">
    <slot name="text" :label="label" />
  </span>
</template>
