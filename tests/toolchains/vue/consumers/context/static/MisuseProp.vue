<script setup lang="ts">
import Badge from "../../../../../integration/cases/context/static/__output__/vue/Badge.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Badge.prop:text -->
  <Badge :text="1" />
</template>
