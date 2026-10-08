<script setup lang="ts">
defineSlots<{ header?(): unknown; default?(): unknown; footer?(): unknown }>();
</script>

<template>
  <article class="card">
    <header>
      <slot name="header" />
    </header>
    <div class="body">
      <slot />
    </div>
    <footer>
      <slot name="footer" />
    </footer>
  </article>
</template>
