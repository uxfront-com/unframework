<script setup lang="ts">
import { ref } from "vue";

const note = ref("Buy milk");
</script>

<template>
  <section aria-label="Note">
    <textarea v-model="note" aria-label="Text"></textarea>
    <output>{{ note.length }} characters</output>
    <button type="button" @click="note = ''">Discard</button>
  </section>
</template>
