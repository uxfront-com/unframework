<script setup lang="ts">
import { onMounted, watch } from "vue";

export interface SectionHeadingProps {
  title: string;
}

const { title } = defineProps<SectionHeadingProps>();
const emit = defineEmits<{ change: [title: string, previous?: string]; ready: [] }>();

watch(
  () => title,
  (value, previous) => {
    emit("change", value, previous);
  },
  { immediate: true },
);

onMounted(() => {
  emit("ready");
});
</script>

<template>
  <h2 class="section-heading">{{ title }}</h2>
</template>
