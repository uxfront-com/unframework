<script setup lang="ts">
import Card from "../../../../../integration/cases/slots/named/__output__/vue/Card.vue";
</script>

<template>
  <Card>
    <!-- @uf-expect TS2493 Card.slot:header -->
    <template #header="props">Content</template>
  </Card>
</template>
