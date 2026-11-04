<script setup lang="ts">
import { useTeardown } from "./useTeardown";

const { name } = defineProps<{ name: string }>();
const emit = defineEmits<{ closed: [entry: string] }>();

const { title } = useTeardown(
  () => name,
  (entry) => emit("closed", entry),
);
</script>

<template>
  <section class="panel" :aria-label="title">
    <h2>{{ title }}</h2>
  </section>
</template>
