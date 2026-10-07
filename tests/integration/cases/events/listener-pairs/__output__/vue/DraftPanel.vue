<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, useTemplateRef, watch } from "vue";

const emit = defineEmits<{
  save: [count: number];
  status: [value: string];
  closed: [reason: string];
  key: [key: string];
}>();

const open = ref(false);
const status = ref("draft");
const saves = ref(0);
const log = shallowRef<string[]>([]);
const handle = useTemplateRef<HTMLButtonElement>("handle");
let handleElement: HTMLButtonElement | null = null;

function record(line: string) {
  log.value = [...log.value, line];
}

function onKey(event: KeyboardEvent) {
  record(`key ${event.key}`);
  emit("key", event.key);
}

function close(reason: string) {
  open.value = false;
  document.removeEventListener("keydown", onEscape);
  emit("closed", reason);
}

function onEscape(event: KeyboardEvent) {
  if (event.key === "Escape") close("escape");
}

function show() {
  open.value = true;
  document.addEventListener("keydown", onEscape);
}

function onHandleClick() {
  record("handle");
}

function save() {
  saves.value += 1;
  status.value = "saved";
  emit("save", saves.value);
}

function stop() {
  document.removeEventListener("keydown", onEscape);
  document.removeEventListener("keydown", onKey);
  handleElement?.removeEventListener("click", onHandleClick);
}

watch(status, (value) => {
  emit("status", value);
});

onMounted(() => {
  handleElement = handle.value;
  handleElement?.addEventListener("click", onHandleClick);
});

onUnmounted(() => stop());

function onClick() {
  document.addEventListener("keydown", onKey);
}

function onClick_1() {
  document.removeEventListener("keydown", onKey);
}
</script>

<template>
  <section class="draft-panel" aria-label="Draft">
    <button type="button" :aria-expanded="open" @click="show">Options</button>
    <div v-if="open" class="options" role="group" aria-label="Draft options">
      <button type="button" @click="close('button')">Close</button>
    </div>
    <button type="button" @click="onClick">Listen</button>
    <button type="button" @click="onClick_1">Stop listening</button>
    <button ref="handle" type="button">Handle</button>
    <button type="button" @click="save">Save</button>
    <p role="status">{{ open ? "Options open" : "Options closed" }}, {{ status }}</p>
    <ol aria-label="Log">
      <li v-for="(line, index) in log" :key="index">{{ line }}</li>
    </ol>
  </section>
</template>
