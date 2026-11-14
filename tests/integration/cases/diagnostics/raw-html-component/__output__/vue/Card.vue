<script setup lang="ts">
const { heading } = defineProps<{ heading: string }>();
</script>

<template>
  <section class="card">
    <h2>{{ heading }}</h2>
  </section>
</template>
