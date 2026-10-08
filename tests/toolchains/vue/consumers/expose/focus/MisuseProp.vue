<script setup lang="ts">
import SearchField from "../../../../../integration/cases/expose/focus/__output__/vue/SearchField.vue";
</script>

<template>
  <!-- @uf-expect TS2322 SearchField.prop:label -->
  <SearchField :label="null" />
</template>
