<script setup lang="ts">
import Heading from "../../../../../integration/cases/dynamic/prop-union/__output__/vue/Heading.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Heading.prop:tag -->
  <Heading tag="h4" text="Setup" />
</template>
