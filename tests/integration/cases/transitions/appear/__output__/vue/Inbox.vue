<script setup lang="ts">
import Toast from "./Toast.vue";
import { ref } from "vue";

const shown = ref(true);
</script>

<template>
  <section aria-label="Inbox">
    <button type="button" @click="shown = !shown">{{ shown ? "Hide" : "Show" }}</button>
    <Toast v-if="shown" />
  </section>
</template>
