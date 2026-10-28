<script setup lang="ts">
interface Fruit {
  id: string;
  name: string;
  children: Fruit[];
}

const { items } = defineProps<{ items: Fruit[] }>();
</script>

<template>
  <p>{{ items.length }} fruits</p>
</template>
