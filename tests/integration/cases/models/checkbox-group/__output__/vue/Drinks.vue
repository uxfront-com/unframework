<script setup lang="ts">
import { shallowRef } from "vue";

const drinks = shallowRef<string[]>(["tea"]);
</script>

<template>
  <fieldset>
    <legend>Drinks</legend>
    <label><input v-model="drinks" type="checkbox" value="tea" /> Tea</label>
    <label><input v-model="drinks" type="checkbox" value="coffee" /> Coffee</label>
    <label><input v-model="drinks" type="checkbox" value="juice" /> Juice</label>
    <output>Ordered: {{ drinks.join(", ") || "nothing" }}</output>
    <button type="button" @click="drinks = ['juice']">Only juice</button>
  </fieldset>
</template>
