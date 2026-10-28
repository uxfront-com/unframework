<script setup lang="ts">
import Button from "../../../../../integration/cases/types/extends-chain/__output__/vue/Button.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Button.prop:label -->
  <Button id="save" :label="1" />
</template>
