<script setup lang="ts">
import Section from "../../../../../integration/cases/components/three-levels/__output__/vue/Section.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Section.prop:body -->
  <Section title="About" :body="false" />
</template>
