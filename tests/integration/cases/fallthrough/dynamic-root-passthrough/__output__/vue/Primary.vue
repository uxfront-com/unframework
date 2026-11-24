<script setup lang="ts">
import Base from "./Base.vue";

const { href = undefined, text } = defineProps<{ href?: string; text: string }>();
</script>

<template>
  <Base :href="href" :text="text" class="primary" />
</template>
