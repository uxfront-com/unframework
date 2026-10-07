<script setup lang="ts">
import { computed, ref } from "vue";

export interface OrderSummaryProps {
  /** The unit price, in cents. */
  price: number;
  taxRate: number;
}

const { price, taxRate } = defineProps<OrderSummaryProps>();

const quantity = ref(1);
const subtotal = computed(() => quantity.value * price);
const tax = computed(() => Math.round(subtotal.value * taxRate));
const total = computed(() => subtotal.value + tax.value);

const tier = computed(() => {
  if (total.value >= 10000) return "bulk";
  return "standard";
});
</script>

<template>
  <section class="order-summary" aria-label="Order summary" :data-tier="tier">
    <p role="status">Quantity: {{ quantity }}</p>
    <button type="button" :disabled="quantity === 1" @click="quantity--">Remove one</button>
    <button type="button" @click="quantity++">Add one</button>
    <p>Subtotal: {{ (subtotal / 100).toFixed(2) }}</p>
    <p>Tax: {{ (tax / 100).toFixed(2) }}</p>
    <p>Total: {{ (total / 100).toFixed(2) }}</p>
  </section>
</template>
