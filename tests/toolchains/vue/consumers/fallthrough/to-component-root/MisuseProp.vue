<script setup lang="ts">
import Primary from "../../../../../integration/cases/fallthrough/to-component-root/__output__/vue/Primary.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Primary.prop:text -->
  <Primary :text="true" />
</template>
