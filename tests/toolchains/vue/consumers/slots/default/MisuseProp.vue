<script setup lang="ts">
import Panel from "../../../../../integration/cases/slots/default/__output__/vue/Panel.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Panel.prop:title -->
  <Panel :title="7" />
</template>
