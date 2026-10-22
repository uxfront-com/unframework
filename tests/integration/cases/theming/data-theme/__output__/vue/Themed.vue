<script setup lang="ts">
import "virtual:styleframe.css";

const { text, dark = false } = defineProps<{ text: string; dark?: boolean }>();
</script>

<template>
  <section
    :data-theme="dark ? 'dark' : 'light'"
    class="_padding:md _background-color:surface _color:text"
  >{{ text }}</section>
</template>
