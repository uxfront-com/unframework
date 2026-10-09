<script setup lang="ts">
import { ref } from "vue";

import Disclosure from "../../../../../integration/cases/semantics/models/__output__/vue/Disclosure.vue";

const open = ref("yes");
</script>

<template>
  <!-- @uf-expect TS2322 Disclosure.model:open -->
  <Disclosure v-model:open="open" title="Shipping" />
</template>
