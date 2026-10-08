<script setup lang="ts">
import Section from "./Section.vue";

const { name } = defineProps<{ name: string }>();
</script>

<template>
  <article aria-label="Profile">
    <Section :title="`About ${name}`" body="Three components deep." />
    <Section title="Contact" :body="`Write to ${name}.`" />
  </article>
</template>
