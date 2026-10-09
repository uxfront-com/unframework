<script setup lang="ts">
import { ref } from "vue";

import Disclosure from "../../../../../integration/cases/semantics/models/__output__/vue/Disclosure.vue";

const open = ref(false);
</script>

<template>
  <Disclosure v-model:open="open" title="Shipping" />
  <Disclosure title="Returns" />
</template>
