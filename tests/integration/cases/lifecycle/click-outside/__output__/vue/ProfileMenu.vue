<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef } from "vue";

const emit = defineEmits<{ closed: [] }>();

const open = ref(false);
const menu = useTemplateRef<HTMLDivElement>("menu");

function onDocumentClick(event: MouseEvent) {
  const element = menu.value;
  if (open.value && element && !element.contains(event.target as Node)) {
    open.value = false;
    emit("closed");
  }
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick);
});
</script>

<template>
  <section class="profile-menu" aria-label="Profile">
    <div ref="menu" class="menu">
      <button type="button" :aria-expanded="open" @click="open = !open">Account</button>
      <ul v-if="open" aria-label="Account actions">
        <li>
          <button type="button">Settings</button>
        </li>
        <li>
          <button type="button">Sign out</button>
        </li>
      </ul>
    </div>
    <p>Outside the menu</p>
  </section>
</template>
