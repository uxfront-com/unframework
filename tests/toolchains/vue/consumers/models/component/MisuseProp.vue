<script setup lang="ts">
import Stepper from "../../../../../integration/cases/models/component/__output__/vue/Stepper.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Stepper.prop:label -->
  <Stepper :label="2" />
</template>
