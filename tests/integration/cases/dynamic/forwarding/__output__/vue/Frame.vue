<script setup lang="ts">
import Card from "./Card.vue";
import Panel from "./Panel.vue";

const { label, wide } = defineProps<{ label: string; wide: boolean }>();
const slots = defineSlots<{ title?(): unknown }>();
</script>

<template>
  <section class="frame" :aria-label="label">
    <component :is="wide ? Panel : Card">
      <template v-if="slots.title" #title>
        <slot name="title" />
      </template>
    </component>
  </section>
</template>
