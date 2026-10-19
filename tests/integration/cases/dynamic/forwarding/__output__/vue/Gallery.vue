<script setup lang="ts">
import Frame from "./Frame.vue";
</script>

<template>
  <div>
    <Frame label="Card" :wide="false">
      <template #title>Sunset</template>
    </Frame>
    <Frame label="Panel" :wide="true">
      <template #title>Dawn</template>
    </Frame>
    <Frame label="Empty" :wide="true" />
  </div>
</template>
