<script setup lang="ts">
import { computed, ref } from "vue";

export interface SeatPickerProps {
  pricePerSeat: number;
}

const { pricePerSeat } = defineProps<SeatPickerProps>();
const emit = defineEmits<{ quote: [seats: number, total: number, summary: string] }>();

const seats = ref(1);
const total = computed(() => seats.value * pricePerSeat);
const summary = computed(() =>
  seats.value === 1 ? `1 seat for ${total.value}` : `${seats.value} seats for ${total.value}`,
);

function addSeat() {
  seats.value += 1;
  emit("quote", seats.value, total.value, summary.value);
}

function addGroupWithGuide() {
  seats.value += 4;
  const groupTotal = total.value;
  seats.value += 1;
  emit("quote", seats.value, total.value, `${summary.value}, ${groupTotal} without the guide`);
}
</script>

<template>
  <section class="seat-picker" aria-label="Seats">
    <p role="status">{{ summary }}</p>
    <button type="button" @click="addSeat">Add a seat</button>
    <button type="button" @click="addGroupWithGuide">Add a group and a guide</button>
  </section>
</template>
