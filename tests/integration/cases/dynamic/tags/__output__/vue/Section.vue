<script setup lang="ts">
import { ref } from "vue";

const { title } = defineProps<{ title: string }>();

const nested = ref(false);
</script>

<template>
  <article>
    <component :is="nested ? 'h3' : 'h2'" class="title">{{ title }}</component>
    <button type="button" @click="nested = !nested">{{ nested ? "Lift" : "Nest" }}</button>
  </article>
</template>
