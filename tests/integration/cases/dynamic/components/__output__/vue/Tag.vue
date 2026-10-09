<script setup lang="ts">
import Card from "./Card.vue";
import Chip from "./Chip.vue";
import { ref } from "vue";

const { label } = defineProps<{ label: string }>();

const compact = ref(true);
</script>

<template>
  <section aria-label="Tag">
    <component :is="compact ? Chip : Card" :label="label" />
    <button type="button" @click="compact = !compact">{{ compact ? "Expand" : "Compact" }}</button>
  </section>
</template>
