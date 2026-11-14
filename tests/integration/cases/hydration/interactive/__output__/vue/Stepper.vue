<script setup lang="ts">
import { ref } from "vue";

export interface StepperProps {
  start?: number;
}

const { start = 0 } = defineProps<StepperProps>();
const emit = defineEmits<{ change: [value: number] }>();

const count = ref(start);

function add() {
  count.value += 1;
  emit("change", count.value);
}
</script>

<template>
  <div class="stepper">
    <output>{{ count }}</output>
    <button type="button" @click="add">Add one</button>
  </div>
</template>
