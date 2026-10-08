<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

export interface ImportQueueProps {
  files: string[];
}

const { files } = defineProps<ImportQueueProps>();
const emit = defineEmits<{ progress: [status: string, attempts: number] }>();

const status = ref("idle");
const attempts = ref(0);

watch([status, attempts], ([nextStatus, nextAttempts]) => {
  emit("progress", nextStatus, nextAttempts);
});

async function importAll() {
  status.value = "starting";
  for (const file of files) {
    attempts.value += 1;
    await nextTick();
    status.value = `imported ${file}`;
  }
  status.value = "done";
}
</script>

<template>
  <section class="import-queue" aria-label="Import">
    <button type="button" @click="importAll">Import all</button>
    <p role="status">{{ status }}, {{ attempts }} attempts</p>
  </section>
</template>
