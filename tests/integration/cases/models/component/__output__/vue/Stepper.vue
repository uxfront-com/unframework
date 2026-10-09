<script setup lang="ts">
const { label } = defineProps<{ label: string }>();
const value = defineModel<number>("value", { default: 0 });
</script>

<template>
  <div class="stepper">
    <button type="button" :aria-label="`Fewer ${label}`" @click="value -= 1">-</button>
    <span>{{ label }}: {{ value }}</span>
    <button type="button" :aria-label="`More ${label}`" @click="value += 1">+</button>
  </div>
</template>
