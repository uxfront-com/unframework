<script lang="ts">
interface HintAttributes {
  id: string;
  style?: string;
}

export interface HintProps {
  text: string;
  attrs: HintAttributes;
}
</script>

<script setup vapor lang="ts">
const { text, attrs } = defineProps<HintProps>();
</script>

<template>
  <small :id="attrs.id" :style="attrs.style">{{ text }}</small>
</template>
