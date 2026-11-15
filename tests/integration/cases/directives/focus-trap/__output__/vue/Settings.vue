<script setup lang="ts">
import { vFocusTrap } from "./vFocusTrap";
import { ref } from "vue";

const open = ref(false);

function close() {
  open.value = false;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") close();
}
</script>

<template>
  <section class="settings" aria-label="Settings">
    <button type="button" @click="open = true">Open</button>
    <div
      v-if="open"
      v-focus-trap="open"
      role="dialog"
      aria-label="Preferences"
      tabindex="-1"
      class="dialog"
      @keydown="onKeydown"
    >
      <button type="button">Theme</button>
      <button type="button">Language</button>
      <button type="button" @click="close">Close</button>
    </div>
  </section>
</template>
