<script setup lang="ts">
import { computed, ref, watch } from "vue";

export interface PriceTagProps {
  /** The unit price, in cents. */
  price: number;
}

const { price } = defineProps<PriceTagProps>();

const quantity = ref(1);
const unit = ref(formatCents(price));
const summary = ref(describe());
const total = computed(() => formatCents(price * quantity.value));
const last = ref("none");

watch(quantity, () => {
  last.value = describe();
});

function add() {
  quantity.value++;
  summary.value = describe();
}

function formatCents(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

function describe(): string {
  return `${quantity.value} at ${formatCents(price)}`;
}
</script>

<template>
  <section class="price-tag" aria-label="Price">
    <p>Unit: {{ unit }}</p>
    <p role="status">{{ summary }}</p>
    <p>Total: {{ total }}</p>
    <p>Last change: {{ last }}</p>
    <button type="button" @click="add">Add one</button>
    <button type="button" @click="unit = formatCents(price * 2)">Price two</button>
  </section>
</template>
