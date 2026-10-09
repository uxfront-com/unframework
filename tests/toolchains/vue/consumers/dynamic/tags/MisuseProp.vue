<script setup lang="ts">
import Section from "../../../../../integration/cases/dynamic/tags/__output__/vue/Section.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Section.prop:title -->
  <Section :title="[]" />
</template>
