<script setup lang="ts">
import List from "../../../../../integration/cases/slots/scoped/__output__/vue/List.vue";
</script>

<template>
  <List :items="['a', 'b']" label="Letters">
    <template #item="{ item, index }">{{ index }}: {{ item.toUpperCase() }}</template>
  </List>
</template>
