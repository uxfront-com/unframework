<script setup lang="ts">
import { ref } from "vue";

const size = ref("m");
</script>

<template>
  <section aria-label="Size">
    <label>Size <select
      v-model="size"
    ><option value="s">Small</option><option value="m">Medium</option><option
      value="l"
    >Large</option></select></label>
    <output>Chosen: {{ size }}</output>
    <button type="button" @click="size = 'l'">Largest</button>
  </section>
</template>
