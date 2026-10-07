<script setup lang="ts">
import { ref, shallowRef, watch, watchPostEffect } from "vue";

export interface ReadingListProps {
  shelves: string[];
}

const { shelves } = defineProps<ReadingListProps>();
const emit = defineEmits<{
  requested: [url: string];
  cancelled: [query: string];
  found: [query: string, count: number];
  started: [];
  checked: [count: number];
  refreshed: [total: number];
}>();

const query = ref("");
const books = shallowRef<string[]>([]);
const searching = ref(false);
const failure = ref("");
const shelf = ref("all");
const checking = ref(false);
const checks = ref(0);
const counts = shallowRef<Record<string, number>>({});
const refreshing = ref(false);
let checker: ReturnType<typeof setInterval> | undefined;

watch(shelf, (value) => {
  localStorage.setItem("reading-list:shelf", value);
});

watch(query, async (value, previous, onCleanup) => {
  const controller = new AbortController();
  onCleanup(() => controller.abort());
  if (value === "") {
    books.value = [];
    searching.value = false;
    return;
  }
  const url = `/api/books?${new URLSearchParams({ q: value, shelf: shelf.value })}`;
  searching.value = true;
  failure.value = "";
  emit("requested", url);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const found = (await response.json()) as string[];
    books.value = found;
    searching.value = false;
    emit("found", value, found.length);
  } catch (error) {
    if (controller.signal.aborted) {
      emit("cancelled", value);
      return;
    }
    searching.value = false;
    failure.value = error instanceof Error ? error.message : "The search failed";
  }
});

watchPostEffect((onCleanup) => {
  if (!checking.value) return;
  const check = () => {
    checks.value += 1;
    emit("checked", checks.value);
  };
  checker = setInterval(check, 1000);
  emit("started");
  onCleanup(() => clearInterval(checker));
});

async function countShelf(name: string) {
  const response = await fetch(`/api/shelves?${new URLSearchParams({ name })}`);
  const list = (await response.json()) as string[];
  counts.value = { ...counts.value, [name]: list.length };
}

async function refreshAll() {
  refreshing.value = true;
  await Promise.all(shelves.map(countShelf));
  refreshing.value = false;
  emit(
    "refreshed",
    shelves.reduce((total, name) => total + (counts.value[name] ?? 0), 0),
  );
}
</script>

<template>
  <section class="reading-list" aria-label="Reading list">
    <label>Search<input
      type="search"
      name="query"
      @input="(event) => (query = (event.currentTarget as HTMLInputElement).value)"
    /></label>
    <p
      role="status"
    >{{ searching ? "Searching" : `${books.length} found` }}{{ failure === "" ? "" : `: ${failure}` }}</p>
    <ul aria-label="Books">
      <li v-for="book in books" :key="book">{{ book }}</li>
    </ul>
    <div role="group" aria-label="Shelf">
      <button type="button" :aria-pressed="shelf === 'all'" @click="shelf = 'all'">All</button>
      <button
        type="button"
        :aria-pressed="shelf === 'unread'"
        @click="shelf = 'unread'"
      >Unread</button>
    </div>
    <button
      type="button"
      :aria-pressed="checking"
      @click="checking = !checking"
    >Check for new books</button>
    <p>Checks: {{ checks }}</p>
    <button type="button" @click="refreshAll">Refresh shelves</button>
    <ul aria-label="Shelves">
      <li v-for="name in shelves" :key="name">{{ name }}: {{ counts[name] ?? "not counted" }}</li>
    </ul>
    <p>{{ refreshing ? "Refreshing" : "Up to date" }}</p>
  </section>
</template>
