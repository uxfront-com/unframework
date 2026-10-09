<script setup lang="ts">
import PriceRange from "./PriceRange.vue";
import { ref } from "vue";

const low = ref(20);
const high = ref(50);
</script>

<template>
  <section aria-label="Search">
    <PriceRange v-model:min="low" v-model:max="high" label="Price" />
    <output>Between {{ low }} and {{ high }}</output>
    <button type="button" @click="high = 40">Cheaper</button>
  </section>
</template>
