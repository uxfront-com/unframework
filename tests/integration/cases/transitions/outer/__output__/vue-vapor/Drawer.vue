<script setup vapor lang="ts">
import { ref } from "vue";

const shown = ref(true);
const open = ref(true);
</script>

<template>
  <section aria-label="Filters" data-uf-54e3e959="">
    <button type="button" data-uf-54e3e959="" @click="shown = !shown">Drawer</button>
    <button type="button" data-uf-54e3e959="" @click="open = !open">Body</button>
    <template v-if="shown">
      <Transition name="fade">
        <p v-if="open" class="body" data-uf-54e3e959="">Colour, size</p>
      </Transition>
    </template>
  </section>
</template>

<style src="./Drawer.uf.tsx.css"></style>
