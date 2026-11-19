<script setup vapor lang="ts">
import Panel from "./Panel.vue";
import { ref } from "vue";

const shown = ref(true);
</script>

<template>
  <main class="board">
    <button type="button" @click="shown = false">Remove panel</button>
    <Panel v-if="shown" />
  </main>
</template>
