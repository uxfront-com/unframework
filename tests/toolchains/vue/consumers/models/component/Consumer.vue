<script setup lang="ts">
import { ref } from "vue";

import Stepper from "../../../../../integration/cases/models/component/__output__/vue/Stepper.vue";

const cups = ref(2);
</script>

<template>
  <Stepper v-model:value="cups" label="Cups" />
</template>
