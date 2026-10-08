<script setup lang="ts">
import Heading from "./Heading.vue";

const { title, body } = defineProps<{ title: string; body: string }>();
</script>

<template>
  <section class="section">
    <Heading :text="title" />
    <p>{{ body }}</p>
  </section>
</template>
