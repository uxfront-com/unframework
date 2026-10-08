<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";

const zoom = ref(100);
const history = shallowRef<string[]>([]);

watch(zoom, (value, previous) => {
  history.value = [...history.value, `${previous}% to ${value}%`];
});
</script>

<template>
  <section class="zoom-control" aria-label="Zoom">
    <output>{{ zoom }}%</output>
    <button type="button" @click="zoom += 25">Zoom in</button>
    <button type="button" @click="zoom -= 25">Zoom out</button>
    <button type="button" @click="zoom = 100">Reset</button>
    <ol aria-label="History">
      <li v-for="(entry, index) in history" :key="index">{{ entry }}</li>
    </ol>
  </section>
</template>
