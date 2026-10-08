<script setup lang="ts">
import Card from "../../../../../integration/cases/slots/presence/__output__/vue/Card.vue";
</script>

<template>
  <Card label="Weather">
    <!-- @uf-expect TS2493 Card.slot:title -->
    <template #title="props">Content</template>
  </Card>
</template>
