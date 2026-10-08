<script setup lang="ts">
import Card from "../../../../../integration/cases/slots/presence/__output__/vue/Card.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Card.prop:label -->
  <Card :label="1" />
</template>
