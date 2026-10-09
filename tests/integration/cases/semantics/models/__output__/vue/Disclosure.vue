<script setup lang="ts">
const { title } = defineProps<{ title: string }>();
const open = defineModel<boolean>("open", { default: false });
</script>

<template>
  <div class="disclosure">
    <button type="button" :aria-expanded="open" @click="open = !open">{{ title }}</button>
    <p v-if="open">Details of {{ title }}</p>
  </div>
</template>
