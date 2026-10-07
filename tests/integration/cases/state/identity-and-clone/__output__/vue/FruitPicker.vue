<script setup lang="ts">
import { shallowRef } from "vue";

export interface Fruit {
  name: string;
  colour: string;
}

export interface FruitPickerProps {
  fruits: Fruit[];
}

const { fruits } = defineProps<FruitPickerProps>();
const emit = defineEmits<{ kept: [name: string, colour: string] }>();

const selected = shallowRef<Fruit | null>(null);
const basket = shallowRef<Fruit[]>([]);

function pick(fruit: Fruit) {
  selected.value = fruit;
}

function keep() {
  const current = selected.value;
  if (!current) return;
  const copy = structuredClone(current);
  basket.value = [...basket.value, copy];
  emit("kept", copy.name, copy.colour);
}
</script>

<template>
  <section class="fruit-picker" aria-label="Fruit">
    <ul aria-label="Fruits">
      <li v-for="fruit in fruits" :key="fruit.name">
        <button
          type="button"
          :aria-pressed="fruit === selected"
          @click="pick(fruit)"
        >{{ fruit.name }}</button>
      </li>
    </ul>
    <button type="button" @click="keep">Keep a copy</button>
    <ol aria-label="Basket">
      <li v-for="(fruit, index) in basket" :key="index">{{ `${fruit.name} (${fruit.colour})` }}</li>
    </ol>
  </section>
</template>
