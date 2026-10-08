<script setup lang="ts">
import Steps from "./Steps.vue";

const { steps } = defineProps<{ steps: string[] }>();
</script>

<template>
  <div>
    <Steps :steps="steps">
      <template #marker>
        <span aria-hidden="true">> </span>
      </template>
    </Steps>
  </div>
</template>
