<script setup lang="ts">
import { onUnmounted, ref, shallowRef, watch, watchPostEffect } from "vue";

const emit = defineEmits<{
  unmounted: [];
  effectCleaned: [query: string];
  watchCleaned: [query: string];
  searched: [query: string, count: number];
  searchCleaned: [query: string];
  summary: [text: string];
}>();

const query = ref("");
const results = shallowRef<string[]>([]);

onUnmounted(() => {
  emit("unmounted");
});

watchPostEffect((onCleanup) => {
  const value = query.value;
  onCleanup(() => {
    emit("effectCleaned", value);
  });
});

watch(
  query,
  (value, previous, onCleanup) => {
    onCleanup(() => {
      emit("watchCleaned", value);
    });
  },
  { immediate: true },
);

watch(query, (value) => {
  results.value = value === "" ? [] : [value, `${value} docs`];
});

watch(
  query,
  (value, previous, onCleanup) => {
    emit("searched", value, results.value.length);
    onCleanup(() => {
      emit("searchCleaned", value);
    });
  },
  { flush: "post" },
);

watchPostEffect(() => {
  emit("summary", `${results.value.length} results for "${query.value}"`);
});
</script>

<template>
  <section class="search-session" aria-label="Search">
    <label>Query<input
      name="query"
      @input="(event) => (query = (event.currentTarget as HTMLInputElement).value)"
    /></label>
    <ul aria-label="Results">
      <li v-for="result in results" :key="result">{{ result }}</li>
    </ul>
    <button type="button" @click="results = []">Clear results</button>
  </section>
</template>
