<script setup lang="ts">
import Badge from "../../../../../integration/cases/components/named-import/__output__/vue/Badge.vue";
import Pill from "../../../../../integration/cases/components/named-import/__output__/vue/Pill.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Pill.prop:text -->
  <Pill :text="0" />
</template>
