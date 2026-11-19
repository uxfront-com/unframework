<script setup vapor lang="ts">
import { type VaporDirective, ref, watchPostEffect } from "vue";

const note = ref("Buy milk");

const vTextCaret: VaporDirective<HTMLTextAreaElement> = (element) => {
  watchPostEffect(() => {
    const text = element.value;
    element.value = "";
    element.value = text;
  });
};
</script>

<template>
  <section aria-label="Note">
    <textarea v-model="note" v-text-caret aria-label="Text"></textarea>
    <output>{{ note.length }} characters</output>
    <button type="button" @click="note = ''">Discard</button>
  </section>
</template>
