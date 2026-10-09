<script setup lang="ts">
import { ref } from "vue";

const colour = ref("none");
</script>

<template>
  <section aria-label="Colours">
    <select
      size="3"
      aria-label="Colour"
      @change="(event) => (colour = (event.currentTarget as HTMLSelectElement).value)"
    >
      <option value="red">Red</option>
      <option value="green">Green</option>
      <option value="blue">Blue</option>
    </select>
    <output>Picked: {{ colour }}</output>
  </section>
</template>
