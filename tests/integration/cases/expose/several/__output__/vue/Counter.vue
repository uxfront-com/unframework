<script setup lang="ts">
import { ref } from "vue";

const { start } = defineProps<{ start: number }>();

const count = ref(start);

function increment() {
  count.value++;
}

const reset = () => {
  count.value = start;
};

defineExpose({ increment, reset });
</script>

<template>
  <output class="count">{{ count }}</output>
</template>
