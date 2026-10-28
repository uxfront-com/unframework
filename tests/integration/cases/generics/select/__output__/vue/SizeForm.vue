<script setup lang="ts">
import Select from "./Select.vue";
import { ref } from "vue";

type Size = "s" | "m" | "l";

const sizes: Size[] = ["s", "m", "l"];
const size = ref<Size>("m");
</script>

<template>
  <section aria-label="Size">
    <Select v-model:value="size" label="Size" :options="sizes" />
    <output>Chosen: {{ size }}</output>
  </section>
</template>
