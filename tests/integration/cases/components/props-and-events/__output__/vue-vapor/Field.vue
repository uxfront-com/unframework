<script lang="ts">
export interface FieldProps {
  label: string;
  tone?: "info" | "warn";
}
</script>

<script setup vapor lang="ts">
const { label, tone = "info" } = defineProps<FieldProps>();
const emit = defineEmits<{ clear: [label: string] }>();
</script>

<template>
  <div class="field" :class="tone">
    <span>{{ label }}</span>
    <button type="button" @click="emit('clear', label)">Clear {{ label }}</button>
  </div>
</template>
