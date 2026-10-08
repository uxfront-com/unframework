<script setup lang="ts">
import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/vue/FileRow.vue";
</script>

<template>
  <!-- @uf-expect TS2322 FileRow.prop:path -->
  <FileRow :path="42" :size="12" />
</template>
