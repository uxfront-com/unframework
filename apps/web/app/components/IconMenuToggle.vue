<script setup lang="ts">
// Replaces Docus's own to name the docs header's menu button, an icon with no
// text, which Docus renders without a name. The label follows the menu's state,
// in Nuxt UI's words for its own header toggle. The button, its icon and its
// animation stay Docus's.
import DocusIconMenuToggle from "docus/app/components/IconMenuToggle.vue";

defineProps<{
  open: boolean;
}>();
</script>

<template>
  <DocusIconMenuToggle :open="open" :aria-label="open ? 'Close menu' : 'Open menu'" />
</template>
