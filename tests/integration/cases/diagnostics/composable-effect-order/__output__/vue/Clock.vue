<script setup lang="ts">
import { useClock } from "./useClock";
import { onMounted, ref } from "vue";

const ready = ref(false);

onMounted(() => {
  ready.value = true;
});

const { started } = useClock();
</script>

<template>
  <p class="clock">{{ ready ? "Ready" : "Waiting" }}, {{ started ? "started" : "stopped" }}</p>
</template>
