<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{ saved: [title: string, bold: boolean] }>();

const title = ref("");
const bold = ref(false);
const saves = ref(0);

function save() {
  saves.value += 1;
  emit("saved", title.value, bold.value);
}
</script>

<template>
  <form class="note-editor" aria-label="Note" @submit.prevent>
    <label>Title<input
      name="title"
      @input="(event) => (title = (event.currentTarget as HTMLInputElement).value)"
    /></label>
    <label>Text<textarea name="text"></textarea></label>
    <div class="format" role="group" aria-label="Format">
      <button
        type="button"
        :aria-pressed="bold"
        @mousedown.prevent
        @click="bold = !bold"
      >Bold</button>
    </div>
    <button type="submit" @click="save">Save</button>
    <p role="status">Saves: {{ saves }}</p>
  </form>
</template>
