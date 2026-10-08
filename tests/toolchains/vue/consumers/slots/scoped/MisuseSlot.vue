<script setup lang="ts">
import List from "../../../../../integration/cases/slots/scoped/__output__/vue/List.vue";
</script>

<template>
  <List :items="['a', 'b']" label="Letters">
    <!-- @uf-expect TS2339 List.slot:item -->
    <template #item="{ size }">{{ size }}</template>
  </List>
</template>
