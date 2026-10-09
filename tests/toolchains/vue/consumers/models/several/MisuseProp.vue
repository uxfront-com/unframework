<script setup lang="ts">
import PriceRange from "../../../../../integration/cases/models/several/__output__/vue/PriceRange.vue";
</script>

<template>
  <!-- @uf-expect TS2322 PriceRange.prop:label -->
  <PriceRange :label="false" />
</template>
