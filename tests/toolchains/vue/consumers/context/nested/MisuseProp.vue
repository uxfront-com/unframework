<script setup lang="ts">
import Level from "../../../../../integration/cases/context/nested/__output__/vue/Level.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Level.prop:title -->
  <Level :title="null" />
</template>
