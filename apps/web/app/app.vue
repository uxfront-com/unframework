<script setup lang="ts">
// This app.vue replaces the Docus one, so docs pages mount the Docus shell
// (header, sidebar, search) themselves. The homepage brings its own, and
// doesn't load this one.
const DocusApp = defineAsyncComponent(() => import("docus/app/app.vue"));

const route = useRoute();
const isDocs = computed(() => route.path === "/docs" || route.path.startsWith("/docs/"));

useHead({
  titleTemplate: (title) => (title ? `${title} - Unframework` : "Unframework"),
});
</script>

<template>
  <NuxtRouteAnnouncer />
  <DocusApp v-if="isDocs" />
  <NuxtPage v-else />
</template>
