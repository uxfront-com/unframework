<script setup lang="ts">
import Table from "./Table.vue";

export interface Person {
  id: string;
  name: string;
}

const { people } = defineProps<{ people: Person[] }>();
</script>

<template>
  <Table :people="people">
    <template #row="{ name, 'data-id': id, index }">
      <span>{{ index + 1 }}: {{ name }} ({{ id }})</span>
    </template>
  </Table>
</template>
