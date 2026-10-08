<script setup lang="ts">
import Row from "../../../../../integration/cases/components/list-rows/__output__/vue/Row.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Row.prop:done -->
  <Row name="Read" done="no" />
</template>
