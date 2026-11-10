<script setup lang="ts">
import { useControllableState } from "./useControllableState";

const { value = undefined } = defineProps<{ value?: number }>();
const emit = defineEmits<{ change: [value: number] }>();

const { current, set } = useControllableState(
  () => value,
  1,
  (next) => emit("change", next),
);
</script>

<template>
  <section class="rating" aria-label="Rating">
    <p role="status">Rated {{ current }} of 3</p>
    <button type="button" @click="set(2)">Two</button>
    <button type="button" @click="set(3)">Three</button>
  </section>
</template>
