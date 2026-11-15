<script setup lang="ts">
import { vClickOutside } from "./vClickOutside";
import { ref } from "vue";

const emit = defineEmits<{ closed: [] }>();

const open = ref(false);

function close() {
  if (!open.value) return;
  open.value = false;
  emit("closed");
}
</script>

<template>
  <section class="profile-menu" aria-label="Profile">
    <div v-click-outside="close" class="menu">
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
