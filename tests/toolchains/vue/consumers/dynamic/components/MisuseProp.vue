<script setup lang="ts">
import Chip from "../../../../../integration/cases/dynamic/components/__output__/vue/Chip.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Chip.prop:label -->
  <Chip :label="0" />
</template>
