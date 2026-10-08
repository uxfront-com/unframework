<script setup lang="ts">
import Box from "./Box.vue";

const { label } = defineProps<{ label: string }>();
const slots = defineSlots<{ title?(): unknown; default?(): unknown }>();
</script>

<template>
  <section class="frame" :aria-label="label">
    <Box>
      <template v-if="slots.default" #default>
        <slot />
      </template>
      <template v-if="slots.title" #title>
        <slot name="title" />
      </template>
    </Box>
  </section>
</template>
