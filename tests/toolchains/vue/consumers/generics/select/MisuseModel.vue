<script setup lang="ts">
import { ref } from "vue";

import Select from "../../../../../integration/cases/generics/select/__output__/vue/Select.vue";

const count = ref(1);
</script>

<template>
  <!-- @uf-expect TS2322 Select.model:value -->
  <Select v-model:value="count" label="Size" :options="['s', 'm']" />
</template>
