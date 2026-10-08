<script setup lang="ts">
const { title } = defineProps<{ title: string }>();
defineSlots<{ default?(): unknown }>();
</script>

<template>
  <section class="panel" :aria-label="title">
    <h2>{{ title }}</h2>
    <slot />
  </section>
</template>
