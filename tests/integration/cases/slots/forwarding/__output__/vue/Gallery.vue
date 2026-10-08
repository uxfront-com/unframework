<script setup lang="ts">
import Frame from "./Frame.vue";
</script>

<template>
  <div>
    <Frame label="Filled">
      <template #default>
        <p>Taken at dusk.</p>
      </template>
      <template #title>Sunset</template>
    </Frame>
    <Frame label="Empty" />
  </div>
</template>
