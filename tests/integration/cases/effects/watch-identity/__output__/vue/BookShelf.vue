<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";

export interface Book {
  id: number;
  title: string;
}

export interface BookShelfProps {
  books: Book[];
}

const { books } = defineProps<BookShelfProps>();
const emit = defineEmits<{
  moved: [title: string, previous: string];
  counted: [summary: string];
  toggled: [open: boolean];
  busy: [label: string, loading: boolean];
  summed: [total: number];
}>();

const focused = shallowRef<Book | null>(null);
const reads = shallowRef(new Map<number, number>());
const open = ref(false);
const label = ref("Idle");
const loading = ref(false);
const low = ref(1);
const high = ref(5);

watch(
  () => focused.value,
  (book, previous) => {
    emit("moved", book?.title ?? "none", previous?.title ?? "none");
  },
);

watch(
  () => reads.value,
  (next) => {
    emit("counted", [...next.entries()].map(([id, times]) => `${id}=${times}`).join(","));
  },
);

watch(
  open,
  (value) => {
    emit("toggled", value);
  },
  { immediate: true },
);

watch([label, loading], ([nextLabel, nextLoading]) => {
  emit("busy", nextLabel, nextLoading);
});

watch([low, high], (values) => {
  emit("summed", sum(values));
});

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function focus(book: Book) {
  focused.value = book;
}

function peek(book: Book) {
  const before = focused.value;
  focused.value = book;
  focused.value = before;
}

function read(book: Book) {
  const next = new Map(reads.value);
  next.set(book.id, (next.get(book.id) ?? 0) + 1);
  reads.value = next;
}

function reread() {
  const before = reads.value;
  reads.value = new Map();
  reads.value = before;
}

function start() {
  label.value = "Loading";
  loading.value = true;
}
</script>

<template>
  <section class="book-shelf" aria-label="Books">
    <ul aria-label="Shelf">
      <li v-for="book in books" :key="book.id">
        <span>{{ book.title }}</span>
        <button type="button" @click="focus(book)">{{ `Focus ${book.title}` }}</button>
        <button type="button" @click="peek(book)">{{ `Peek ${book.title}` }}</button>
        <button type="button" @click="read(book)">{{ `Read ${book.title}` }}</button>
      </li>
    </ul>
    <p>Focused: {{ focused?.title ?? "none" }}</p>
    <p>Books read: {{ reads.size }}</p>
    <button type="button" @click="reread">Count again</button>
    <button type="button" :aria-expanded="open" @click="open = !open">Details</button>
    <button type="button" @click="start">Start</button>
    <p role="status">{{ label }}: {{ loading ? "busy" : "idle" }}</p>
    <button type="button" @click="high += 1">Raise the limit</button>
    <p>Range: {{ low }} to {{ high }}</p>
  </section>
</template>
