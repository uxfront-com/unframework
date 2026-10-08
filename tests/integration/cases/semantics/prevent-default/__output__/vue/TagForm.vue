<script setup lang="ts">
import { ref, shallowRef, useTemplateRef } from "vue";

const emit = defineEmits<{ tagsChange: [tags: string[]] }>();

const tags = shallowRef<string[]>([]);
const draft = ref("");
const helpOpen = ref(false);
const field = useTemplateRef<HTMLInputElement>("field");

function blockComma(event: KeyboardEvent) {
  if (event.key === ",") event.preventDefault();
}

function updateDraft(event: InputEvent) {
  draft.value = (event.currentTarget as HTMLInputElement).value;
}

function addTag(event: SubmitEvent) {
  event.preventDefault();
  if (draft.value !== "" && !tags.value.includes(draft.value)) {
    tags.value = [...tags.value, draft.value];
    emit("tagsChange", tags.value);
  }
  draft.value = "";
  const input = field.value;
  if (input) input.value = "";
}

function toggleHelp(event: MouseEvent) {
  event.preventDefault();
  helpOpen.value = !helpOpen.value;
}
</script>

<template>
  <form class="tag-form" aria-label="Tags" @submit="addTag">
    <label>New tag<input ref="field" name="tag" @keydown="blockComma" @input="updateDraft" /></label>
    <button type="submit">Add tag</button>
    <a href="/help/tags" @click="toggleHelp">How tags work</a>
    <p v-if="helpOpen">A tag is one word: commas are not allowed.</p>
    <ul aria-label="Added tags">
      <li v-for="tag in tags" :key="tag">{{ tag }}</li>
    </ul>
  </form>
</template>
