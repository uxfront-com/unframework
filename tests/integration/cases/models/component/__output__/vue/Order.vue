<script setup lang="ts">
import Stepper from "./Stepper.vue";
import { ref } from "vue";

const cups = ref(2);
</script>

<template>
  <section aria-label="Order">
    <Stepper v-model:value="cups" label="Cups" />
    <output>Ordered: {{ cups }}</output>
    <button type="button" @click="cups = 0">Clear</button>
  </section>
</template>
