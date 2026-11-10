<script setup lang="ts">
import List from "../../../../../integration/cases/generics/list/__output__/vue/List.vue";
</script>

<template>
  <!-- @uf-expect TS2322 List.prop:selected -->
  <List label="Numbers" :items="[1, 2]" selected="two" />
</template>
