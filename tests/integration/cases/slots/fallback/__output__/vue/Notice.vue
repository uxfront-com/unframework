<script setup lang="ts">
const { label } = defineProps<{ label: string }>();
defineSlots<{ default?(): unknown; action?(): unknown }>();
</script>

<template>
  <div role="note" :aria-label="label" class="notice">
    <p>
      <slot>
        <em>Nothing to report.</em>
      </slot>
    </p>
    <slot name="action">
      <span class="muted">No action</span>
    </slot>
  </div>
</template>
