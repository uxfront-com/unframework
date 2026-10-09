<script setup lang="ts">
import Greeting from "../../../../../integration/cases/context/fallback/__output__/vue/Greeting.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Greeting.prop:name -->
  <Greeting :name="7" />
</template>
