<script setup lang="ts">
import { ref } from "vue";

defineSlots<{ default?(): unknown }>();

const open = ref(false);
</script>

<template>
  <div class="disclosure">
    <button type="button" :aria-expanded="open" @click="open = !open">Details</button>
    <div v-if="open" class="body">
      <slot />
    </div>
  </div>
</template>
