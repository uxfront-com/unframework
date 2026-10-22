<script setup lang="ts">
const { busy, text } = defineProps<{ busy: boolean; text: string }>();
</script>

<template>
  <span v-if="busy" class="badge" role="status">Saving</span>
  <button v-else type="button" class="badge">{{ text }}</button>
</template>
