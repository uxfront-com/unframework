<script setup lang="ts">
import Field from "../../../../../integration/cases/components/props-and-events/__output__/vue/Field.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Field.event:clear -->
  <Field label="Street" @clear="(count: number) => count + 1" />
</template>
