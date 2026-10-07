<script setup lang="ts">
import { ref, watch } from "vue";

export interface PriceRangeProps {
  currency: string;
}

const { currency } = defineProps<PriceRangeProps>();
const emit = defineEmits<{
  spanUpdate: [span: number];
  rangeUpdate: [low: number, high: number];
  currencyUpdate: [currency: string];
}>();

const low = ref(10);
const high = ref(50);

watch(
  () => high.value - low.value,
  (span) => {
    emit("spanUpdate", span);
  },
);

watch([low, high], ([minimum, maximum]) => {
  emit("rangeUpdate", minimum, maximum);
});

watch(
  () => currency,
  (value) => {
    emit("currencyUpdate", value);
  },
);

function onClick() {
  low.value += 10;
  high.value += 10;
}
</script>

<template>
  <section class="price-range" aria-label="Price range">
    <p role="status">{{ low }} to {{ high }} {{ currency }}</p>
    <button type="button" @click="onClick">Shift up</button>
    <button type="button" @click="high += 10">Widen</button>
  </section>
</template>
