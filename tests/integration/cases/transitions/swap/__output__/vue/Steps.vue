<script setup lang="ts">
import { ref } from "vue";

const first = ref(true);
const step = ref(1);
</script>

<template>
  <section class="steps" aria-label="Checkout" data-uf-84fe8ccf="">
    <button type="button" data-uf-84fe8ccf="" @click="first = !first">Swap</button>
    <Transition name="swap">
      <p v-if="first" class="card" data-uf-84fe8ccf="">Cart</p>
      <p v-else class="card" data-uf-84fe8ccf="">Payment</p>
    </Transition>
    <button type="button" data-uf-84fe8ccf="" @click="step = (step % 3) + 1">Next</button>
    <Transition name="step">
      <p v-if="step === 1" class="step" data-uf-84fe8ccf="">Step one</p>
      <p v-else-if="step === 2" class="step" data-uf-84fe8ccf="">Step two</p>
      <p v-else class="step" data-uf-84fe8ccf="">Step three</p>
    </Transition>
  </section>
</template>

<style src="./Steps.uf.tsx.css"></style>
