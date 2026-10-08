<script setup lang="ts">
const { label } = defineProps<{ label: string }>();
defineOptions({ inheritAttrs: false });
</script>

<template>
  <label class="field">{{ label }} <input :name="label.toLowerCase()" /></label>
</template>
