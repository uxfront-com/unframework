<script setup lang="ts">
import { ref, shallowRef, useTemplateRef } from "vue";

const emit = defineEmits<{ saved: [count: number]; tagged: [tag: string, via: string] }>();

const saves = ref(0);
const lastKey = ref("none");
const tags = shallowRef<string[]>([]);
const tag = ref("");
const tagField = useTemplateRef<HTMLInputElement>("tagField");

function save() {
  saves.value += 1;
  emit("saved", saves.value);
}

function recordKey(event: KeyboardEvent) {
  lastKey.value = event.key;
}

function addTag(event: MouseEvent | KeyboardEvent) {
  if (tag.value === "") return;
  tags.value = [...tags.value, tag.value];
  emit("tagged", tag.value, event.type);
  tag.value = "";
  if (tagField.value) tagField.value.value = "";
}

function onTagKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") addTag(event);
}
</script>

<template>
  <section class="note-editor" aria-label="Note">
    <button type="button" @click="save">Save</button>
    <label>Title<input name="title" @keydown="recordKey" /></label>
    <label>Body<textarea name="body" @keydown="recordKey"></textarea></label>
    <p role="status">Saved {{ saves }} times, last key {{ lastKey }}</p>
    <button type="button" @click="save">Save and close</button>
    <label>Tag<input
      ref="tagField"
      name="tag"
      @input="(event) => (tag = (event.currentTarget as HTMLInputElement).value)"
      @keydown="onTagKeydown"
    /></label>
    <button type="button" @click="addTag">Add tag</button>
    <p>Tags: {{ tags.join(", ") }}</p>
  </section>
</template>
