<script setup lang="ts">
const { name, done } = defineProps<{ name: string; done: boolean }>();
</script>

<template>
  <div role="listitem" class="row" :class="{ done }">{{ name }}{{ done ? " (done)" : "" }}</div>
</template>
