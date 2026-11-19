<script lang="ts">
export interface CounterProps {
  initial?: number;
  step?: number;
}
</script>

<script setup vapor lang="ts">
import { computed, ref } from "vue";

const { initial = 0, step = 1 } = defineProps<CounterProps>();
const emit = defineEmits<{ change: [value: number] }>();

const count = ref(initial);
const doubled = computed(() => count.value * 2);

function increment() {
  count.value += step;
  emit("change", count.value);
}
</script>

<template>
  <div class="counter">
    <output>{{ count }}</output>
    <span v-if="doubled > 10">Big</span>
    <button type="button" @click="increment">+{{ step }}</button>
  </div>
</template>
