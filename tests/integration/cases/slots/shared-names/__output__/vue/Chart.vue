<script setup lang="ts">
import Legend from "./Legend.vue";

const { series } = defineProps<{ series: string[] }>();
</script>

<template>
  <div>
    <Legend :items="series" label="Series">
      <template #swatch="{ item }">
        <b>{{ item.slice(0, 1) }}</b>
      </template>
      <template #caption="{ item }">
        <i>{{ item }}</i>
      </template>
    </Legend>
    <Legend :items="series" label="Captions">
      <template #caption="{ item }">
        <span>{{ item.toUpperCase() }}</span>
      </template>
    </Legend>
  </div>
</template>
