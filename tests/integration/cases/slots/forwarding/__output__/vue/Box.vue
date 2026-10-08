<script setup lang="ts">
defineSlots<{ title?(): unknown; default?(): unknown }>();
</script>

<template>
  <div class="box">
    <h3>
      <slot name="title">Untitled</slot>
    </h3>
    <slot>
      <p>No content</p>
    </slot>
  </div>
</template>
