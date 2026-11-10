<script setup lang="ts">
import { ref } from "vue";

import Select from "../../../../../integration/cases/generics/select/__output__/vue/Select.vue";

const size = ref<"s" | "m">("s");
</script>

<template>
  <Select v-model:value="size" label="Size" :options="['s', 'm']" />
</template>
