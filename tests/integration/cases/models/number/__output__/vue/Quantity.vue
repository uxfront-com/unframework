<script setup lang="ts">
import { ref } from "vue";

const count = ref(2);
const volume = ref(5);
</script>

<template>
  <section aria-label="Order">
    <input v-model="count" type="number" aria-label="Count" min="0" />
    <input v-model.number="volume" type="range" aria-label="Volume" min="0" max="10" />
    <output>Next: {{ count + 1 }}, volume {{ volume + 1 }}</output>
    <button type="button" @click="count = 10">Ten</button>
  </section>
</template>
