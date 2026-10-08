<script setup lang="ts">
import Card from "../../../../../integration/cases/components/local-sibling/__output__/vue/Card.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Card.prop:title -->
  <Card :title="1" />
</template>
