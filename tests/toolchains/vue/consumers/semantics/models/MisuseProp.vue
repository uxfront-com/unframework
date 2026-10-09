<script setup lang="ts">
import Disclosure from "../../../../../integration/cases/semantics/models/__output__/vue/Disclosure.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Disclosure.prop:title -->
  <Disclosure :title="1" />
</template>
