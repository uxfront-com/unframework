<script setup lang="ts">
const emit = defineEmits<{ save: [] }>();
</script>

<template>
  <button type="button" @click="emit('save')">Save</button>
</template>
