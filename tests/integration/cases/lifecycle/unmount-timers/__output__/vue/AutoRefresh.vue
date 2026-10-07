<script setup lang="ts">
import { onUnmounted, ref } from "vue";

export interface AutoRefreshProps {
  /** Milliseconds between two refreshes. */
  interval: number;
}

const { interval } = defineProps<AutoRefreshProps>();
const emit = defineEmits<{ refresh: [count: number] }>();

const enabled = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;
let refreshes = 0;

function tick() {
  refreshes += 1;
  emit("refresh", refreshes);
}

function toggle() {
  if (enabled.value) {
    clearInterval(timer);
    enabled.value = false;
  } else {
    timer = setInterval(tick, interval);
    enabled.value = true;
  }
}

onUnmounted(() => {
  clearInterval(timer);
});
</script>

<template>
  <section class="auto-refresh" aria-label="Auto-refresh">
    <button type="button" :aria-pressed="enabled" @click="toggle">Auto-refresh</button>
    <p role="status">{{ enabled ? "Refreshing" : "Paused" }}</p>
  </section>
</template>
