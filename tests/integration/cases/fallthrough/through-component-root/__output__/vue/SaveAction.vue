<script setup lang="ts">
import Pressable from "./Pressable.vue";

const { text } = defineProps<{ text: string }>();
</script>

<template>
  <Pressable :text="text" class="save" />
</template>
