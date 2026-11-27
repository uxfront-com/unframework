<script setup lang="ts">
const { strong } = defineProps<{ strong: boolean }>();
defineSlots<{ default?(): unknown }>();
</script>

<template>
  <p class="emphasis">
    <b v-if="strong">
      <slot />
    </b>
    <i v-else>
      <slot />
    </i>
  </p>
</template>
