<script setup lang="ts">
import Table from "../../../../../integration/cases/generics/constrained/__output__/vue/Table.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Table.prop:rows -->
  <Table caption="People" :rows="[{ id: 1, label: 'Ada Lovelace' }]" />
</template>
