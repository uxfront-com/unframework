<script setup lang="ts">
const { bold } = defineProps<{ bold: boolean }>();
defineSlots<{ default?(): unknown }>();
</script>

<template>
  <div class="fade-face" data-uf-c9301a2a="">
    <Transition name="face">
      <b v-if="bold" class="face" data-uf-c9301a2a="">
        <slot />
      </b>
      <i v-else class="face" data-uf-c9301a2a="">
        <slot />
      </i>
    </Transition>
  </div>
</template>

<style src="./FadeFace.uf.tsx.css"></style>
