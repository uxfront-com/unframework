<script setup lang="ts">
import { ref } from "vue";

const open = ref(true);
</script>

<template>
  <section aria-label="Shipping" data-uf-357b6b1f="">
    <button
      type="button"
      :aria-expanded="open"
      data-uf-357b6b1f=""
      @click="open = !open"
    >Shipping</button>
    <Transition name="outer">
      <div v-if="open" class="panel" data-uf-357b6b1f="">
        <Transition name="inner">
          <p class="note" data-uf-357b6b1f="">Ships in two days.</p>
        </Transition>
      </div>
    </Transition>
  </section>
</template>

<style src="./Accordion.uf.tsx.css"></style>
