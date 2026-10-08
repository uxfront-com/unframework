<script setup lang="ts">
import { nextTick, ref } from "vue";

const emit = defineEmits<{ saved: [attempt: number, status: string] }>();

const status = ref("Not saved");
const attempts = ref(0);

async function save() {
  status.value = "Saving";
  attempts.value += 1;
  await Promise.resolve();
  status.value = "Checking";
  await nextTick();
  status.value = `Saved, attempt ${attempts.value}`;
  emit("saved", attempts.value, status.value);
}
</script>

<template>
  <section class="save-draft" aria-label="Draft">
    <p role="status">{{ status }}</p>
    <button type="button" @click="save">Save the draft</button>
  </section>
</template>
