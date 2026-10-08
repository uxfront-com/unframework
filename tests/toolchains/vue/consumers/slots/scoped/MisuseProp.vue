<script setup lang="ts">
import List from "../../../../../integration/cases/slots/scoped/__output__/vue/List.vue";
</script>

<template>
  <!-- @uf-expect TS2322 List.prop:label -->
  <List :items="['a']" :label="1" />
</template>
