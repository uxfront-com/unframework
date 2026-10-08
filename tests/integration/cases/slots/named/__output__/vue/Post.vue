<script setup lang="ts">
import Card from "./Card.vue";

const { author } = defineProps<{ author: string }>();
</script>

<template>
  <Card>
    <template #default>
      <p>Slots arrive in M3.</p>
    </template>
    <template #header>
      <h2>Release notes</h2>
    </template>
    <template #footer>
      <small>By {{ author }}</small>
    </template>
  </Card>
</template>
