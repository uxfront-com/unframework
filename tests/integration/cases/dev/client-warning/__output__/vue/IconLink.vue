<script setup lang="ts">
import { onMounted, useTemplateRef } from "vue";

const { href, label = undefined } = defineProps<{ href: string; label?: string }>();

const link = useTemplateRef<HTMLAnchorElement>("link");

onMounted(() => {
  if (process.env.NODE_ENV !== "production") {
    const name = link.value?.getAttribute("aria-label") ?? link.value?.textContent?.trim();
    if (!name) console.warn("IconLink has no accessible name: give it a `label` or some text.");
  }
});
</script>

<template>
  <a ref="link" :href="href" :aria-label="label">
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M2 8h10M8 4l4 4-4 4" />
    </svg>
  </a>
</template>
