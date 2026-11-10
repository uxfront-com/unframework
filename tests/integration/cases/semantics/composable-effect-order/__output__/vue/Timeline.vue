<script setup lang="ts">
import { useTracked } from "./useTracked";
import { onMounted, shallowRef, watch } from "vue";

const entries = shallowRef<string[]>([]);

function record(entry: string) {
  entries.value = [...entries.value, entry];
}

onMounted(() => record("caller mounted first"));

const { count, increment } = useTracked((entry) => record(entry));

watch(
  () => count.value,
  () => record("caller watcher"),
);

onMounted(() => record("caller mounted last"));
</script>

<template>
  <section class="timeline" aria-label="Timeline">
    <p role="status">Count: {{ count }}</p>
    <button type="button" @click="increment()">Increment</button>
    <ol>
      <li v-for="(entry, index) in entries" :key="index">{{ entry }}</li>
    </ol>
  </section>
</template>
