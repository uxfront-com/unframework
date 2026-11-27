<script setup lang="ts">
const { title } = defineProps<{ title: string }>();
defineSlots<{ default?(): unknown }>();
</script>

<template>
  <article class="framed-note">
    <header>
      <slot />
    </header>
    <p>{{ title }}</p>
    <footer>
      <slot />
    </footer>
  </article>
</template>
