<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();

const code = props.error.statusCode ?? 500;
const notFound = code === 404;
const title = notFound ? "Page not found" : "Something went wrong";

useSeoMeta({
  title,
  description: title,
  robots: "noindex",
});

const goHome = (event: MouseEvent) => {
  event.preventDefault();
  void clearError({ redirect: "/" });
};
</script>

<template>
  <UxErrorPage
    :code="code"
    :title="title"
    :lead="notFound ? 'This page compiles to nothing.' : 'Please try again in a moment.'"
    home-label="Back to Unframework"
    @home="goHome"
  />
</template>
