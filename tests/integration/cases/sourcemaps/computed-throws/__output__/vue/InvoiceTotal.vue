<script setup lang="ts">
import { computed, ref } from "vue";

export interface InvoiceTotalProps {
  quantity: number;
}

const { quantity } = defineProps<InvoiceTotalProps>();

const refunded = ref(0);

const total = computed(() => {
  const units = quantity - refunded.value;
  if (units < 0) {
    throw new Error("The total is negative");
  }
  return units * 5;
});

function refund() {
  refunded.value = refunded.value + 3;
}
</script>

<template>
  <div>
    <output>{{ total }}</output>
    <button type="button" @click="refund">Refund</button>
  </div>
</template>
