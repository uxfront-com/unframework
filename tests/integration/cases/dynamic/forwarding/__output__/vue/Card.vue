<script setup lang="ts">
defineSlots<{ title?(): unknown }>();
</script>

<template>
  <div class="card">
    <h3>
      <slot name="title">Untitled</slot>
    </h3>
  </div>
</template>
