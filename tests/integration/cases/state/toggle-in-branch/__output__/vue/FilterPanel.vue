<script setup lang="ts">
import { ref } from "vue";

const open = ref(false);
const colour = ref<string | null>(null);
const note = ref<string | null>(null);

function onClick() {
  colour.value = null;
  open.value = false;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    note.value = null;
  }
}
</script>

<template>
  <section class="filter-panel" aria-label="Filters">
    <button
      v-if="open"
      type="button"
      aria-expanded="true"
      @click="open = false"
    >Hide colours</button>
    <button v-else type="button" aria-expanded="false" @click="open = true">Show colours</button>
    <div v-if="open" class="colours">
      <button type="button" @click="colour = 'Red'">Red</button>
      <button type="button" @click="colour = 'Blue'">Blue</button>
      <button type="button" @click="onClick">Reset</button>
    </div>
    <div v-if="colour" class="selection">
      <p>{{ `Colour: ${colour}` }}</p>
      <button type="button" @click="colour = null">{{ `Clear ${colour}` }}</button>
    </div>
    <p v-else>No colour</p>
    <button v-if="note === null" type="button" @click="note = ''">Add a note</button>
    <div v-else class="note">
      <label>Note<input
        @input="(event) => (note = (event.currentTarget as HTMLInputElement).value)"
        @keydown="onKeydown"
      /></label>
      <p>{{ `Draft: "${note}"` }}</p>
    </div>
  </section>
</template>
