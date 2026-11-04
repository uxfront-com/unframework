<script setup lang="ts">
import Panel from "./Panel.vue";
import { ref, shallowRef } from "vue";

const showA = ref(true);
const showB = ref(true);
const entries = shallowRef<string[]>([]);

function record(entry: string) {
  entries.value = [...entries.value, entry];
}
</script>

<template>
  <div class="board">
    <Panel v-if="showA" name="a" @closed="record" />
    <Panel v-if="showB" name="b" @closed="record" />
    <button type="button" @click="showA = false">Hide a</button>
    <button type="button" @click="showB = false">Hide b</button>
    <output>{{ entries.join(", ") }}</output>
  </div>
</template>
