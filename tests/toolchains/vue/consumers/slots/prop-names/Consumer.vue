<script setup lang="ts">
import Table from "../../../../../integration/cases/slots/prop-names/__output__/vue/Table.vue";
</script>

<template>
  <Table :people="[{ id: 'a', name: 'Ada' }]">
    <template #row="{ name, index }">{{ index }}: {{ name.toUpperCase() }}</template>
  </Table>
</template>
