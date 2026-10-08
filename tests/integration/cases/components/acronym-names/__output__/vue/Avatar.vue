<script setup lang="ts">
const { imageURL, userID } = defineProps<{ imageURL: string; userID: number }>();
const emit = defineEmits<{ pickedURL: [url: string] }>();
</script>

<template>
  <button
    type="button"
    :data-user="userID"
    @click="emit('pickedURL', imageURL)"
  >User {{ userID }}: {{ imageURL }}</button>
</template>
