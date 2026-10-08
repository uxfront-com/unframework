<script setup lang="ts">
defineSlots<{ title?(): unknown; default?(): unknown }>();
</script>

<template>
  <main>
    <h1>
      <slot name="title" />
    </h1>
    <slot />
  </main>
</template>
