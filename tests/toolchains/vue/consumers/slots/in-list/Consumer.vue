<script setup lang="ts">
import Steps from "../../../../../integration/cases/slots/in-list/__output__/vue/Steps.vue";
</script>

<template>
  <Steps :steps="['Boil']">
    <template #marker>*</template>
  </Steps>
</template>
