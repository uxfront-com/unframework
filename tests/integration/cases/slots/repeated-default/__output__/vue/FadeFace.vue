<script setup lang="ts">
const { bold } = defineProps<{ bold: boolean }>();
defineSlots<{ default?(): unknown }>();
</script>

<template>
  <div class="fade-face">
    <Transition name="face">
      <b v-if="bold" class="face">
        <slot />
      </b>
      <i v-else class="face">
        <slot />
      </i>
    </Transition>
  </div>
</template>
