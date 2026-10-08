<script setup lang="ts">
import Panel from "./Panel.vue";

const { name } = defineProps<{ name: string }>();
</script>

<template>
  <Panel title="Welcome">
    <p>Hello, <strong>{{ name }}</strong>!</p>
    <p>Your children render in the panel.</p>
  </Panel>
</template>
