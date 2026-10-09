<script setup lang="ts">
import { ref } from "vue";

const name = ref("Ada");
const email = ref("");
</script>

<template>
  <form aria-label="Contact">
    <label>Name <input v-model="name" /></label>
    <label>Email <input v-model="email" type="email" /></label>
    <output>{{ name }} at {{ email || "no address" }}</output>
    <button type="button" @click="name = 'Grace'">Use Grace</button>
  </form>
</template>
