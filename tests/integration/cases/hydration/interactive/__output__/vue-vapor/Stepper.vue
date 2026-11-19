<script lang="ts">
export interface StepperProps {
  start?: number;
}
</script>

<script setup vapor lang="ts">
import { ref } from "vue";

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
