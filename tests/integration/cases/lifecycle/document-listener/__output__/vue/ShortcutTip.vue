<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";

const emit = defineEmits<{ dismissed: []; shortcut: [key: string, count: number] }>();

const open = ref(true);
const enabled = ref(false);
const count = ref(0);

function onEscape(event: KeyboardEvent) {
  if (event.key === "Escape") {
    open.value = false;
    emit("dismissed");
  }
}

function onShortcut(event: KeyboardEvent) {
  if (event.key === "k") {
    count.value += 1;
    emit("shortcut", event.key, count.value);
  }
}

function toggle() {
  enabled.value = !enabled.value;
}

watch(
  enabled,
  (on) => {
    if (on) {
      document.addEventListener("keydown", onShortcut);
    } else {
      document.removeEventListener("keydown", onShortcut);
    }
  },
  { flush: "post" },
);

onMounted(() => {
  document.addEventListener("keydown", onEscape);
});

onUnmounted(() => {
  document.removeEventListener("keydown", onEscape);
  document.removeEventListener("keydown", onShortcut);
});
</script>

<template>
  <section class="shortcut-tip" aria-label="Shortcuts">
    <p>{{ open ? "Press Escape to hide this tip." : "Tip hidden." }}</p>
    <button type="button" :aria-pressed="enabled" @click="toggle">Shortcut K</button>
    <p role="status">Used: {{ count }}</p>
  </section>
</template>
