<script lang="ts">
export interface PageProps {
  message: string;
}
</script>

<script setup vapor lang="ts">
import Toast from "./Toast.vue";

const { message } = defineProps<PageProps>();
</script>

<template>
  <section class="page" aria-label="Page" data-uf-5a3bed67="">
    <p data-uf-5a3bed67="">Saving…</p>
    <Toast :message="message" data-uf-5a3bed67="" />
  </section>
</template>

<style src="./Page.uf.tsx.css"></style>
