<script setup lang="ts">
import Picker from "../../../../../integration/cases/generics/scoped-slot/__output__/vue/Picker.vue";

const fruits = [{ name: "Apple", count: 3 }];
</script>

<template>
  <Picker :items="fruits">
    <!-- @uf-expect TS2339 Picker.slot:item -->
    <template #item="{ item }">{{ item.nmae }}</template>
  </Picker>
</template>
