<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

const emit = defineEmits<{ saved: [count: number] }>();

const saves = ref(0);

function onShortcut(event: KeyboardEvent) {
  if (event.key !== "s" || !event.ctrlKey) return;
  event.preventDefault();
  saves.value += 1;
  emit("saved", saves.value);
}

onMounted(() => {
  document.addEventListener("keydown", onShortcut);
});

onUnmounted(() => {
  document.removeEventListener("keydown", onShortcut);
});
</script>

<template>
  <section class="draft-editor" aria-label="Draft">
    <label>Draft<textarea name="draft"></textarea></label>
    <p role="status">Saved: {{ saves }}</p>
  </section>
</template>
