<script setup lang="ts">
import Base from "./Base.vue";

const { text } = defineProps<{ text: string }>();
</script>

<template>
  <Base :text="text" class="primary" />
</template>
