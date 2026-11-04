<script setup lang="ts">
import { useMediaQuery } from "./useMediaQuery";

const { matches: wide } = useMediaQuery("(min-width: 1px)");
const { matches: tiny } = useMediaQuery("(max-width: 1px)");
</script>

<template>
  <section class="layout" aria-label="Layout">
    <p role="status">{{ wide ? "Wide layout" : "Narrow layout" }}</p>
    <p>{{ tiny ? "Tiny screen" : "Not a tiny screen" }}</p>
  </section>
</template>
