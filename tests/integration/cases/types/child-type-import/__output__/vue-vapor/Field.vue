<script lang="ts">
export interface FieldProps {
  name: string;
  label: string;
}
</script>

<script setup vapor lang="ts">
const { name, label } = defineProps<FieldProps>();
</script>

<template>
  <label>{{ label }}<input :name="name" /></label>
</template>
