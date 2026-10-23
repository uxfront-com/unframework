<script setup lang="ts">
interface HintAttributes {
  id: string;
  style?: string;
}

export interface HintProps {
  text: string;
  attrs: HintAttributes;
}

const { text, attrs } = defineProps<HintProps>();
</script>

<template>
  <small :id="attrs.id" :style="attrs.style">{{ text }}</small>
</template>
