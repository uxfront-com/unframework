<script setup lang="ts">
import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/vue/FileRow.vue";
</script>

<template>
  <!-- @uf-expect TS2322 FileRow.event:open -->
  <FileRow path="notes.txt" :size="12" @open="(index: number) => index + 1" />
</template>
