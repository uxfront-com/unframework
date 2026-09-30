<script setup lang="ts">
useHead({
  titleTemplate: (title) => (title ? `${title} - Unframework` : "Unframework"),
});
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
</template>
