<script setup lang="ts">
const { label } = defineProps<{ label: string }>();
defineOptions({ inheritAttrs: false });
</script>

<template>
  <input name="bio" :aria-label="label" />
</template>
