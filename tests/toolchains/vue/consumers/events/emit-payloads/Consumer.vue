<script setup lang="ts">
import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/vue/FileRow.vue";

function open(path: string): string {
  return path.toUpperCase();
}
</script>

<template>
  <FileRow path="notes.txt" :size="12" @open="open" />
</template>
