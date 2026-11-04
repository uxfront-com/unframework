<script setup lang="ts">
import { useTotal } from "./useTotal";
import { ref } from "vue";

const { price } = defineProps<{ price: number }>();

const quantity = ref(1);
const { total, label } = useTotal(
  () => price,
  () => quantity.value,
);
</script>

<template>
  <section class="basket" aria-label="Basket">
    <p role="status">Total: {{ total }}</p>
    <p>{{ label }}</p>
    <button type="button" @click="quantity++">Add one</button>
  </section>
</template>
