<script setup lang="ts">
import Countdown from "../../../../../integration/cases/components/recursion/__output__/vue/Countdown.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Countdown.prop:from -->
  <Countdown from="two" />
</template>
