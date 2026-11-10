<script setup lang="ts" generic="T extends string">
export interface SelectProps<T extends string> {
  label: string;
  options: readonly T[];
}

const { label, options } = defineProps<SelectProps<T>>();
const value = defineModel<T>("value", { required: true });
</script>

<template>
  <label>{{ label }} <select
    v-model="value"
  ><option v-for="option in options" :key="option" :value="option">{{ option }}</option></select></label>
</template>
