<script setup lang="ts">
import Picker from "../../../../../integration/cases/generics/scoped-slot/__output__/vue/Picker.vue";

const fruits = [{ name: "Apple", count: 3 }];
</script>

<template>
  <Picker :items="fruits">
    <template #item="{ item }">{{ item.name }} × {{ item.count }}</template>
  </Picker>
</template>
