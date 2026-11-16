<script setup lang="ts">
import { vRecord } from "./vRecord";
import { ref } from "vue";

const level = ref(1);
const renders = ref(0);
</script>

<template>
  <section class="meter" aria-label="Meter">
    <output v-record="level" class="level">Level {{ level }}</output>
    <p>Rendered again {{ renders }} times</p>
    <button type="button" @click="level++">Raise</button>
    <button type="button" @click="renders++">Render again</button>
  </section>
</template>
