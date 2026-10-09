<script setup lang="ts">
import Level from "../../../../../integration/cases/context/nested/__output__/vue/Level.vue";
</script>

<template>
  <Level title="Book">
    <!-- @uf-expect TS2493 Level.slot:default -->
    <template #default="props">Part</template>
  </Level>
</template>
