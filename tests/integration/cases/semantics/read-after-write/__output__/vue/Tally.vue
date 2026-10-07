<script setup lang="ts">
import { ref, shallowRef } from "vue";

const emit = defineEmits<{
  total: [value: number];
  steps: [values: number[]];
  logged: [entries: string[]];
}>();

const count = ref(0);
const trail = shallowRef<string[]>([]);

function addTwice() {
  count.value++;
  count.value++;
  emit("total", count.value);
}

function addFive() {
  count.value += 5;
  emit("total", count.value);
}

function countUp() {
  const seen: number[] = [];
  for (let step = 0; step < 3; step++) {
    count.value += 1;
    seen.push(count.value);
  }
  emit("steps", seen);
}

function addTen() {
  count.value += 10;
}

function addTenAndReport() {
  addTen();
  emit("total", count.value);
}

function logCapture() {
  trail.value = [...trail.value, "capture"];
}

function logBubble() {
  trail.value = [...trail.value, "bubble"];
  emit("logged", trail.value);
}
</script>

<template>
  <section class="tally" aria-label="Tally">
    <p role="status">Count: {{ count }}</p>
    <button type="button" @click="addTwice">Add two</button>
    <button type="button" @click="addFive">Add five</button>
    <button type="button" @click="countUp">Count up three</button>
    <button type="button" @click="addTenAndReport">Add ten</button>
    <button type="button" @click.capture="logCapture" @click="logBubble">Log the phases</button>
    <p>Phases: {{ trail.join(" then ") }}</p>
  </section>
</template>
