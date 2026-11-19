<script lang="ts">
export interface Person {
  id: string;
  name: string;
}
</script>

<script setup vapor lang="ts">
import Table from "./Table.vue";

const { people } = defineProps<{ people: Person[] }>();
</script>

<template>
  <Table :people="people">
    <template #row="{ name, 'data-id': id, index }">
      <span>{{ index + 1 }}: {{ name }} ({{ id }})</span>
    </template>
  </Table>
</template>
