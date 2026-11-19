<script lang="ts">
export interface StepListProps {
  title: string;
  steps: string[];
}
</script>

<script setup vapor lang="ts">
const { title, steps } = defineProps<StepListProps>();
</script>

<template>
  <ol class="step-list" :aria-label="title">
    <li
      v-for="(step, index) in steps"
      :key="index"
      :data-step="index + 1"
    >Step {{ index + 1 }}: {{ step }}</li>
  </ol>
</template>
