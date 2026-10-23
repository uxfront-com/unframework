<script setup lang="ts">
import "virtual:styleframe.css";

const { label } = defineProps<{ label: string }>();
</script>

<template>
  <span
    class="_padding:lg _background-color:primary _color:on-primary _border-radius:[4px]"
  >{{ label }}</span>
</template>
