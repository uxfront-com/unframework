<script setup lang="ts">
import { ref } from "vue";

defineSlots<{ default?(): unknown }>();

const open = ref(false);
</script>

<template>
  <div class="card">
    <button type="button" @click="open = !open">Toggle card</button>
    <div v-if="open" class="body">
      <slot />
    </div>
  </div>
</template>
