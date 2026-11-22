<script setup lang="ts">
import Chip from "./Chip.vue";
import { shallowRef } from "vue";

const log = shallowRef<string[]>([]);

function record(line: string) {
  log.value = [...log.value, line];
}
</script>

<template>
  <section aria-label="Picker">
    <Chip
      label="Ada"
      @click="(event) => record(`click on ${(event.currentTarget as Element).localName}`)"
      @pick="(label) => record(`pick ${label}`)"
      @focus="(event) => record(`focus on ${(event.currentTarget as Element).localName}`)"
      @keydown="(event) => record(`keydown ${event.key} on ${(event.currentTarget as Element).localName}`)"
    />
    <ol aria-label="Log">
      <li v-for="(entry, index) in log" :key="index">{{ entry }}</li>
    </ol>
  </section>
</template>
