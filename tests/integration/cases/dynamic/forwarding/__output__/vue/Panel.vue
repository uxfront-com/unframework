<script setup lang="ts">
defineSlots<{ title?(): unknown }>();
</script>

<template>
  <div class="panel">
    <h4>
      <slot name="title">Untitled</slot>
    </h4>
  </div>
</template>
