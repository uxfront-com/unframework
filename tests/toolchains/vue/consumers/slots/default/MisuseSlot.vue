<script setup lang="ts">
import Panel from "../../../../../integration/cases/slots/default/__output__/vue/Panel.vue";
</script>

<template>
  <Panel title="Hello">
    <!-- @uf-expect TS2493 Panel.slot:default -->
    <template #default="props">Content</template>
  </Panel>
</template>
