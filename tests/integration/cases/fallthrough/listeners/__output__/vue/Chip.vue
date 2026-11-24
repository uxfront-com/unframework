<script setup lang="ts">
const { label } = defineProps<{ label: string }>();
const emit = defineEmits<{ pick: [label: string] }>();
</script>

<template>
  <button type="button" class="chip" @click="emit('pick', label)">{{ label }}</button>
</template>
