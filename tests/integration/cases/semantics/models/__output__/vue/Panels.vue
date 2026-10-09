<script setup lang="ts">
import Disclosure from "./Disclosure.vue";
import { ref } from "vue";

const shipping = ref(true);
</script>

<template>
  <section aria-label="Panels">
    <Disclosure v-model:open="shipping" title="Shipping" />
    <Disclosure title="Returns" />
    <output>Shipping is {{ shipping ? "open" : "closed" }}</output>
    <button type="button" @click="shipping = !shipping">Toggle shipping</button>
  </section>
</template>
