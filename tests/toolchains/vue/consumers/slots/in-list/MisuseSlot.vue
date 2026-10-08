<script setup lang="ts">
import Steps from "../../../../../integration/cases/slots/in-list/__output__/vue/Steps.vue";
</script>

<template>
  <Steps :steps="['Boil']">
    <!-- @uf-expect TS2493 Steps.slot:marker -->
    <template #marker="props">Content</template>
  </Steps>
</template>
