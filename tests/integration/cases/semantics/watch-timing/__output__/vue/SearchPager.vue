<script setup lang="ts">
import { ref, watch } from "vue";

const emit = defineEmits<{
  queryRun: [value: string, previous: string];
  pageRun: [value: number, previous: number];
  cleanedUp: [watcher: string];
}>();

const query = ref("");
const page = ref(1);

watch(query, (value, previous, onCleanup) => {
  emit("queryRun", value, previous);
  onCleanup(() => {
    emit("cleanedUp", "query");
  });
});

watch(page, (value, previous) => {
  emit("pageRun", value, previous);
});

function search(term: string) {
  query.value = term;
  query.value = query.value.toLowerCase();
  page.value = 1;
}

function nextPage() {
  page.value += 1;
}

function skipTwoPages() {
  page.value += 1;
  page.value += 1;
}
</script>

<template>
  <section class="search-pager" aria-label="Search">
    <p
      role="status"
    >{{ query === "" ? "All results" : `Results for ${query}` }}, page {{ page }}</p>
    <button type="button" @click="search('Boots')">Search boots</button>
    <button type="button" @click="search('Sandals')">Search sandals</button>
    <button type="button" @click="nextPage">Next page</button>
    <button type="button" @click="skipTwoPages">Skip two pages</button>
  </section>
</template>
