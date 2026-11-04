<script setup lang="ts">
import { useCounter } from "./useCounter";
import { ref } from "vue";

const emit = defineEmits<{ limit: [count: number] }>();

const message = ref("Keep going");

const { count, step, increment, reset } = useCounter(3, (reached) => {
  message.value = `Reached ${reached}`;
  emit("limit", reached);
});
</script>

<template>
  <section class="clicker" aria-label="Clicker">
    <p role="status">Count: {{ count }}</p>
    <p>{{ message }}</p>
    <button type="button" @click="increment()">Add {{ step }}</button>
    <button type="button" @click="reset()">Reset</button>
  </section>
</template>
