<script setup lang="ts">
import { shallowRef } from "vue";

const STEPS = [1, 5, 10] as const;
const LIMITS = Object.freeze({ min: 0, max: 20 });
const caption = (value: number): string => `${value} of ${LIMITS.max}`;
const START = LIMITS.min + 2;

const value = shallowRef(START);

function add(step: number) {
  value.value = Math.min(LIMITS.max, value.value + step);
}
</script>

<template>
  <section class="stepper" aria-label="Stepper">
    <p role="status">{{ caption(value) }}</p>
    <ul>
      <li v-for="step in STEPS" :key="step">
        <button type="button" @click="add(step)">Add {{ step }}</button>
      </li>
    </ul>
  </section>
</template>
