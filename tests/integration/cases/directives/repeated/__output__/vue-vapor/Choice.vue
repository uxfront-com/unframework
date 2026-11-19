<script setup vapor lang="ts">
import { ref } from "vue";

defineSlots<{ body?(): unknown }>();

const first = ref(true);
</script>

<template>
  <div class="choice">
    <b v-if="first">
      <slot name="body" />
    </b>
    <i v-else>
      <slot name="body" />
    </i>
    <button type="button" @click="first = !first">Switch</button>
  </div>
</template>
