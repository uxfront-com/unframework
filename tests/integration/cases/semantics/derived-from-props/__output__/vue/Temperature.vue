<script setup lang="ts">
import { computed, watch } from "vue";

export interface TemperatureProps {
  celsius: number;
}

const { celsius } = defineProps<TemperatureProps>();
const emit = defineEmits<{ reading: [celsius: number, previous: number] }>();

const fahrenheit = computed(() => Math.round((celsius * 9) / 5 + 32));
const level = computed(() => (celsius >= 30 ? "hot" : celsius <= 5 ? "cold" : "mild"));

watch(
  () => celsius,
  (value, previous) => {
    emit("reading", value, previous);
  },
);
</script>

<template>
  <figure class="temperature" :data-level="level">
    <p>{{ celsius }} °C</p>
    <p>{{ fahrenheit }} °F</p>
    <figcaption>Feels {{ level }}</figcaption>
  </figure>
</template>
