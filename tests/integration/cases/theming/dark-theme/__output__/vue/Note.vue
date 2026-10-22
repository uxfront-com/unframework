<script setup lang="ts">
import "virtual:styleframe.css";

const { text } = defineProps<{ text: string }>();
</script>

<template>
  <p class="_padding:md _background-color:surface _color:text">{{ text }}</p>
</template>
