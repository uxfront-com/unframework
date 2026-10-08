<script setup lang="ts">
import Table from "../../../../../integration/cases/slots/prop-names/__output__/vue/Table.vue";
</script>

<template>
  <Table :people="[{ id: 'a', name: 'Ada' }]">
    <!-- @uf-expect TS2339 Table.slot:row -->
    <template #row="{ size }">{{ size }}</template>
  </Table>
</template>
