<script setup lang="ts">
import Notice from "../../../../../integration/cases/slots/fallback/__output__/vue/Notice.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Notice.prop:label -->
  <Notice :label="1" />
</template>
