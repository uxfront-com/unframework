<script setup lang="ts">
import { shallowRef } from "vue";

const toppings = shallowRef<string[]>(["cheese"]);
</script>

<template>
  <section aria-label="Pizza">
    <label>Toppings <select
      v-model="toppings"
      multiple
    ><option value="cheese">Cheese</option><option value="olives">Olives</option><option
      value="basil"
    >Basil</option></select></label>
    <output>On top: {{ toppings.join(", ") || "nothing" }}</output>
    <button type="button" @click="toppings = ['basil', 'olives']">Green</button>
  </section>
</template>
