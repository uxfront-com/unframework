<script setup lang="ts">
import Names from "../../../../../integration/cases/slots/scoped-default/__output__/vue/Names.vue";
</script>

<template>
  <Names :names="['Ada']">
    <template #default="{ item }">{{ item.toUpperCase() }}</template>
  </Names>
</template>
