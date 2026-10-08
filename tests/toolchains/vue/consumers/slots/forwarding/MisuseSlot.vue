<script setup lang="ts">
import Frame from "../../../../../integration/cases/slots/forwarding/__output__/vue/Frame.vue";
</script>

<template>
  <Frame label="Shot">
    <!-- @uf-expect TS2493 Frame.slot:title -->
    <template #title="props">Content</template>
  </Frame>
</template>
