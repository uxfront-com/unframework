<script setup lang="ts">
import { ref } from "vue";

import PriceRange from "../../../../../integration/cases/models/several/__output__/vue/PriceRange.vue";

const high = ref("ten");
</script>

<template>
  <!-- @uf-expect TS2322 PriceRange.model:max -->
  <PriceRange v-model:max="high" label="Price" />
</template>
