<script setup lang="ts">
import Chart from "./Chart.vue";
import { ref } from "vue";

const open = ref(false);

function show() {
  open.value = true;
}
</script>

<template>
  <section aria-label="Report">
    <button type="button" @click="show">Show the chart</button>
    <Chart v-if="open" />
  </section>
</template>
