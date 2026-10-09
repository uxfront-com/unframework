<script setup lang="ts">
import Greeting from "../../../../../integration/cases/context/fallback/__output__/vue/Greeting.vue";
import LocaleProvider from "../../../../../integration/cases/context/fallback/__output__/vue/LocaleProvider.vue";
</script>

<template>
  <LocaleProvider locale="pt">
    <Greeting name="Inês" />
  </LocaleProvider>
</template>
