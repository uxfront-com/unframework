<script setup lang="ts">
import { useCart } from "./useCart";

const emit = defineEmits<{ total: [items: number]; cleared: [empty: boolean] }>();

const { items, empty, add, clear } = useCart();

function addTwiceAndReport() {
  add(1);
  add(2);
  emit("total", items.value);
}

function clearAndReport() {
  clear();
  emit("cleared", empty.value);
}
</script>

<template>
  <section class="cart" aria-label="Cart">
    <p role="status">Items: {{ items }}</p>
    <button type="button" @click="addTwiceAndReport">Add three</button>
    <button type="button" @click="clearAndReport">Clear</button>
  </section>
</template>
