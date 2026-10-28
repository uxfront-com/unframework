<script setup lang="ts">
import Status from "../../../../../integration/cases/types/package-types/__output__/vue/Status.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Status.prop:closed -->
  <Status label="Feed" closed="yes" />
</template>
