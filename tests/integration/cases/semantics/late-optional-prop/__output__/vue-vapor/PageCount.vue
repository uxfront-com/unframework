<script lang="ts">
export interface PageCountProps {
  page?: number;
  total: number;
}
</script>

<script setup vapor lang="ts">
import { computed, watch } from "vue";

const { page = 1, total } = defineProps<PageCountProps>();
const emit = defineEmits<{ pageChange: [page: number, previous: number] }>();

const label = computed(() => `Page ${page} of ${total}`);

watch(
  () => page,
  (next, previous) => {
    emit("pageChange", next, previous);
  },
);
</script>

<template>
  <nav class="page-count" aria-label="Pages">
    <p role="status">{{ label }}</p>
    <p>Direct: {{ page }}</p>
  </nav>
</template>
