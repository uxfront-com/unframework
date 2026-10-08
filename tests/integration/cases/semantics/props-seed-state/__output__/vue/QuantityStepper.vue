<script setup lang="ts">
import { ref } from "vue";

export interface QuantityStepperProps {
  initial: number;
  label: string;
}

const { initial, label } = defineProps<QuantityStepperProps>();

const quantity = ref(initial);
</script>

<template>
  <div class="quantity-stepper" role="group" :aria-label="label">
    <output>{{ quantity }}</output>
    <button type="button" :aria-label="`Increase ${label}`" @click="quantity++">+</button>
  </div>
</template>
