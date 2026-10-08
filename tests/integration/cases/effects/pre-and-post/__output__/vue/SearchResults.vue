<script setup lang="ts">
import { nextTick, onMounted, ref, shallowRef, useTemplateRef, watch } from "vue";

const emit = defineEmits<{
  ready: [text: string];
  rendered: [count: number];
  shown: [text: string];
}>();

const status = ref("Loading");
const query = ref("");
const results = shallowRef<string[]>([]);
const count = ref(0);
const doubled = ref(0);
const banner = useTemplateRef<HTMLParagraphElement>("banner");
const list = useTemplateRef<HTMLUListElement>("list");
const total = useTemplateRef<HTMLOutputElement>("total");

watch(query, (value) => {
  results.value = value === "" ? [] : [value, `${value} docs`];
});

watch(
  query,
  () => {
    emit("rendered", list.value?.childElementCount ?? -1);
  },
  { flush: "post" },
);

watch(count, (value) => {
  doubled.value = value * 2;
});

onMounted(async () => {
  status.value = "Ready";
  await nextTick();
  emit("ready", banner.value?.textContent ?? "");
});

async function addOne() {
  count.value += 1;
  await nextTick();
  emit("shown", total.value?.textContent ?? "");
}
</script>

<template>
  <section class="search-results" aria-label="Search">
    <p ref="banner">{{ status }}</p>
    <label>Query<input
      name="query"
      @input="(event) => (query = (event.currentTarget as HTMLInputElement).value)"
    /></label>
    <ul ref="list" aria-label="Results">
      <li v-for="result in results" :key="result">{{ result }}</li>
    </ul>
    <output ref="total">{{ doubled }}</output>
    <button type="button" @click="addOne">Add one</button>
  </section>
</template>
