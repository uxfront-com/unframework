<script setup lang="ts">
import Names from "../../../../../integration/cases/slots/scoped-default/__output__/vue/Names.vue";
</script>

<template>
  <Names :names="['Ada']">
    <!-- @uf-expect TS2339 Names.slot:default -->
    <template #default="{ size }">{{ size }}</template>
  </Names>
</template>
