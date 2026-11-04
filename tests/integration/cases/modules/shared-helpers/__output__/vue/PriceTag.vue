<script setup lang="ts">
import { formatPrice, pluralise } from "./format";
import { computed, ref } from "vue";

const { cents } = defineProps<{ cents: number }>();
const emit = defineEmits<{ order: [summary: string] }>();

const quantity = ref(1);
const total = computed(() => formatPrice(cents * quantity.value));

function order() {
  emit("order", `${pluralise(quantity.value, "item")} for ${total.value}`);
}
</script>

<template>
  <section class="price-tag" aria-label="Price">
    <p>Each: {{ formatPrice(cents) }}</p>
    <p role="status">{{ pluralise(quantity, "item") }}: {{ total }}</p>
    <button type="button" @click="quantity++">One more</button>
    <button type="button" @click="order">Order</button>
  </section>
</template>
