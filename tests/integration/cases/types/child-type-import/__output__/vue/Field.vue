<script setup lang="ts">
export interface FieldProps {
  name: string;
  label: string;
}

const { name, label } = defineProps<FieldProps>();
</script>

<template>
  <label>{{ label }}<input :name="name" /></label>
</template>
