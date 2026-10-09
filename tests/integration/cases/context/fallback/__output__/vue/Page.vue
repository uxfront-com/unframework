<script setup lang="ts">
import Greeting from "./Greeting.vue";
import LocaleProvider from "./LocaleProvider.vue";
</script>

<template>
  <main>
    <Greeting name="Ada" />
    <LocaleProvider locale="pt">
      <Greeting name="Inês" />
    </LocaleProvider>
  </main>
</template>
