<script setup lang="ts">
import Field from "../../../../../integration/cases/components/props-and-events/__output__/vue/Field.vue";

function clear(label: string): string {
  return label.toUpperCase();
}
</script>

<template>
  <Field label="Street" tone="warn" @clear="clear" />
</template>
