<script setup vapor lang="ts">
import { ref } from "vue";

const open = ref(true);
</script>

<template>
  <nav class="menu" aria-label="Account" data-uf-e688a71a="">
    <button
      type="button"
      :aria-expanded="open"
      data-uf-e688a71a=""
      @click="open = !open"
    >Account</button>
    <Transition name="fade">
      <ul v-if="open" class="items" data-uf-e688a71a="">
        <li data-uf-e688a71a="">Profile</li>
        <li data-uf-e688a71a="">Sign out</li>
      </ul>
    </Transition>
  </nav>
</template>

<style src="./Menu.uf.tsx.css"></style>
