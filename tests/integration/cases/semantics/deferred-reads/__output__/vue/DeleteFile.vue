<script setup lang="ts">
import { ref } from "vue";

export interface DeleteFileProps {
  fileName: string;
}

const { fileName } = defineProps<DeleteFileProps>();
const emit = defineEmits<{ deleted: [fileName: string, copies: number] }>();

const copies = ref(1);
const confirming = ref(false);
let resolveConfirmation: (() => void) | undefined;

async function requestDelete() {
  confirming.value = true;
  await new Promise<void>((resolve) => {
    resolveConfirmation = resolve;
  });
  confirming.value = false;
  emit("deleted", fileName, copies.value);
}

function addCopy() {
  copies.value += 1;
}

function confirmDelete() {
  resolveConfirmation?.();
}
</script>

<template>
  <section class="delete-file" aria-label="File">
    <p>{{ fileName }}, {{ copies }} {{ copies === 1 ? "copy" : "copies" }}</p>
    <button type="button" @click="addCopy">Add a copy</button>
    <button v-if="confirming" type="button" @click="confirmDelete">Confirm the deletion</button>
    <button v-else type="button" @click="requestDelete">Delete</button>
  </section>
</template>
