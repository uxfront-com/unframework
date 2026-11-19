<script setup vapor lang="ts">
import Picker from "./Picker.vue";
import { vTrace } from "./vTrace";
</script>

<template>
  <section class="page" aria-label="Page">
    <Picker>
      <template #option="{ option }">
        <span v-trace="option.label" :data-name="`option-${option.id}`">{{ option.label }}</span>
      </template>
    </Picker>
  </section>
</template>
