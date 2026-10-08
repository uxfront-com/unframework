<script setup lang="ts">
import Frame from "../../../../../integration/cases/slots/forwarding/__output__/vue/Frame.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Frame.prop:label -->
  <Frame :label="0" />
</template>
