<script setup lang="ts">
export interface Person {
  id: string;
  name: string;
}

const { people } = defineProps<{ people: Person[] }>();
defineSlots<{ row?(props: { name: string; "data-id": string; index: number }): unknown }>();
</script>

<template>
  <ol aria-label="People">
    <li v-for="(person, index) in people" :key="person.id">
      <slot name="row" v-bind="{ name: person.name, 'data-id': person.id, index }" />
    </li>
  </ol>
</template>
