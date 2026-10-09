<script setup lang="ts">
import { ref } from "vue";

const name = ref("");
const city = ref("Lisbon");
const weight = ref(0);
</script>

<template>
  <form aria-label="Profile">
    <label>Name <input v-model.trim="name" /></label>
    <label>City <input v-model.lazy="city" /></label>
    <label>Weight <input v-model.number="weight" /></label>
    <output>[{{ name }}] from {{ city }}, {{ weight + 1 }}</output>
  </form>
</template>
