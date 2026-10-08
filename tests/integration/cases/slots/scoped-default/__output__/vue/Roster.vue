<script setup lang="ts">
import Names from "./Names.vue";

const { names } = defineProps<{ names: string[] }>();
</script>

<template>
  <Names :names="names">
    <template #default="{ item }">
      <b>{{ item }}!</b>
    </template>
  </Names>
</template>
