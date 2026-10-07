<script setup lang="ts">
import { ref, shallowRef } from "vue";

const emit = defineEmits<{ sent: [text: string]; saved: [count: number]; firstSave: [] }>();

const tags = shallowRef<string[]>([]);
const query = ref("");
const panelOpen = ref(true);
const confirming = ref(true);
const tipShown = ref(true);
const saves = ref(0);
const log = shallowRef<string[]>([]);
let finishUpload: (() => void) | undefined;

function record(line: string) {
  log.value = [...log.value, line];
}

function send(event: KeyboardEvent) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  emit("sent", (event.target as HTMLTextAreaElement).value);
}

function addTag(event: KeyboardEvent) {
  event.preventDefault();
  const field = event.target as HTMLInputElement;
  if (field.value === "" || tags.value.includes(field.value)) return;
  tags.value = [...tags.value, field.value];
  field.value = "";
}

function clearSearch(event: KeyboardEvent) {
  event.stopPropagation();
  query.value = "";
  (event.target as HTMLInputElement).value = "";
}

function dismiss(event: MouseEvent) {
  event.stopPropagation();
  confirming.value = false;
  record("dismissed");
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter") return;
  addTag(event);
}

function onKeydown_1(event: KeyboardEvent) {
  if (event.key.length === 1 && (event.target as HTMLInputElement).value.length >= 4)
    event.preventDefault();
}

function onKeydown_2(event: KeyboardEvent) {
  if (event.key === "Escape") panelOpen.value = false;
}

function onKeydown_3(event: KeyboardEvent) {
  if (event.key === "Escape" && (event.target as HTMLInputElement).value !== "") clearSearch(event);
}

function onClick(event: PointerEvent) {
  if (event.target !== event.currentTarget) return;
  event.stopPropagation();
  tipShown.value = false;
}

function onClick_1(event: PointerEvent) {
  if (event.target === event.currentTarget) dismiss(event);
}

function onClick_2() {
  if (tags.value.length === 0) return;
  saves.value += 1;
  emit("saved", saves.value);
}

async function onClick_3() {
  record("upload started");
  await new Promise<void>((resolve) => {
    finishUpload = resolve;
  });
  record("upload finished");
}

function onClick_4() {
  finishUpload?.();
}
</script>

<template>
  <section class="comment-composer" aria-label="Composer">
    <label>Comment<textarea name="comment" @keydown="send"></textarea></label>
    <form aria-label="Tags" @submit.prevent="record('tags submitted')">
      <label>Tag<input name="tag" @keydown="onKeydown" /></label>
      <button type="submit">Save tags</button>
    </form>
    <ul aria-label="Tag list">
      <li v-for="tag in tags" :key="tag">{{ tag }}</li>
    </ul>
    <label>Code<input name="code" @keydown="onKeydown_1" /></label>
    <div class="panel" role="presentation" @keydown="onKeydown_2">
      <label>Search<input
        name="search"
        @input="(event) => (query = (event.currentTarget as HTMLInputElement).value)"
        @keydown="onKeydown_3"
      /></label>
      <p>{{ panelOpen ? `Searching for: ${query}` : "Panel closed" }}</p>
    </div>
    <div class="page" role="presentation" @click="record('page')">
      <div
        v-if="tipShown"
        class="tip"
        role="presentation"
        style="padding: 12px"
        @click="onClick"
      >Click here to hide this tip.<button
        type="button"
        @click="record('tip button')"
      >More tips</button></div>
      <div
        v-if="confirming"
        class="backdrop"
        role="presentation"
        data-testid="backdrop"
        style="padding: 24px"
        @click="onClick_1"
      >
        <div role="dialog" aria-label="Discard draft">
          <p>Discard this draft?</p>
          <button type="button" @click="record('kept')">Keep</button>
        </div>
      </div>
      <p v-else>Draft dismissed</p>
    </div>
    <button type="button" @click="onClick_2" @click.once="emit('firstSave')">Save</button>
    <button type="button" @click="onClick_3" @click.once="record('first upload')">Upload</button>
    <button type="button" @click="onClick_4">Finish upload</button>
    <ol aria-label="Log">
      <li v-for="(line, index) in log" :key="index">{{ line }}</li>
    </ol>
  </section>
</template>
