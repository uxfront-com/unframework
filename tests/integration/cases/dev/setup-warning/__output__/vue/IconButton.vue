<script setup lang="ts">
const { label = undefined } = defineProps<{ label?: string }>();

if (process.env.NODE_ENV !== "production") {
  if (!label) console.warn("IconButton has no accessible name: pass it a `label`.");
}
</script>

<template>
  <button type="button" :aria-label="label">
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M8 1l2 5h5l-4 3 2 6-5-4-5 4 2-6-4-3h5z" />
    </svg>
  </button>
</template>
