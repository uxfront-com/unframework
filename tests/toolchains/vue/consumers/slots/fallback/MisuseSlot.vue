<script setup lang="ts">
import Notice from "../../../../../integration/cases/slots/fallback/__output__/vue/Notice.vue";
</script>

<template>
  <Notice label="Build">
    <!-- @uf-expect TS2493 Notice.slot:action -->
    <template #action="props">Content</template>
  </Notice>
</template>
