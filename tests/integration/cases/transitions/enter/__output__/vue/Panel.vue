<script setup lang="ts">
import { ref } from "vue";

const open = ref(false);
</script>

<template>
  <section class="panel" aria-label="Delivery" data-uf-eab7eeb4="">
    <button
      type="button"
      :aria-expanded="open"
      data-uf-eab7eeb4=""
      @click="open = !open"
    >Details</button>
    <Transition>
      <p v-if="open" class="details" data-uf-eab7eeb4="">Ships in two days.</p>
    </Transition>
  </section>
</template>

<style src="./Panel.uf.tsx.css"></style>
