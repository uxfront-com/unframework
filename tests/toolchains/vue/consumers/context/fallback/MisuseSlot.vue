<script setup lang="ts">
import LocaleProvider from "../../../../../integration/cases/context/fallback/__output__/vue/LocaleProvider.vue";
</script>

<template>
  <LocaleProvider locale="pt">
    <!-- @uf-expect TS2493 LocaleProvider.slot:default -->
    <template #default="props">Olá</template>
  </LocaleProvider>
</template>
