<script setup lang="ts">
import { vMark } from "./vMark";
import { ref } from "vue";

const shown = ref(true);
</script>

<template>
  <section aria-label="News" data-uf-53025c4a="">
    <button type="button" data-uf-53025c4a="" @click="shown = false">Dismiss</button>
    <Transition name="fade">
      <p v-if="shown" v-mark="'banner'" class="banner" data-uf-53025c4a="">New releases are out.</p>
    </Transition>
  </section>
</template>

<style src="./Banner.uf.tsx.css"></style>
