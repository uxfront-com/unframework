<script setup lang="ts">
import { ref } from "vue";

import Stepper from "../../../../../integration/cases/models/component/__output__/vue/Stepper.vue";

const cups = ref("two");
</script>

<template>
  <!-- @uf-expect TS2322 Stepper.model:value -->
  <Stepper v-model:value="cups" label="Cups" />
</template>
