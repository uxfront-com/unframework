<script setup lang="ts">
import { ref } from "vue";

const note = ref("Buy milk");

const vTextCaret = {
  mounted(element: HTMLTextAreaElement) {
    const text = element.value;
    element.value = "";
    element.value = text;
  },
};
</script>

<template>
  <section aria-label="Note">
    <textarea v-model="note" v-text-caret aria-label="Text"></textarea>
    <output>{{ note.length }} characters</output>
    <button type="button" @click="note = ''">Discard</button>
  </section>
</template>
