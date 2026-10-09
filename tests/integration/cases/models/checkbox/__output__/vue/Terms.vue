<script setup lang="ts">
import { ref } from "vue";

const agreed = ref(false);
</script>

<template>
  <section aria-label="Terms">
    <label><input v-model="agreed" type="checkbox" /> I agree</label>
    <output>{{ agreed ? "Agreed" : "Not agreed" }}</output>
    <button type="button" @click="agreed = !agreed">Toggle</button>
  </section>
</template>
