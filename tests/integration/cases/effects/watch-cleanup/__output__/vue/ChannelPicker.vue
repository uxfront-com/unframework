<script setup lang="ts">
import { ref, watch } from "vue";

const emit = defineEmits<{ join: [channel: string]; leave: [channel: string] }>();

const channel = ref("general");

watch(
  () => channel.value.toLowerCase(),
  (name, previous, onCleanup) => {
    emit("join", name);
    onCleanup(() => {
      emit("leave", name);
    });
  },
  { immediate: true },
);
</script>

<template>
  <section class="channel-picker" aria-label="Channels">
    <p role="status">Channel: #{{ channel }}</p>
    <button type="button" @click="channel = 'random'">Join #random</button>
    <button type="button" @click="channel = 'General'">Join #General</button>
  </section>
</template>
