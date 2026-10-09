<script setup lang="ts">
import { ref } from "vue";

import PriceRange from "../../../../../integration/cases/models/several/__output__/vue/PriceRange.vue";

const low = ref(0);
const high = ref(10);
</script>

<template>
  <PriceRange v-model:min="low" v-model:max="high" label="Price" />
</template>
