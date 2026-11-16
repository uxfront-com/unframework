<script setup lang="ts">
import { ref } from "vue";

const open = ref(true);
const refreshes = ref(0);

function refresh() {
  refreshes.value++;
  open.value = false;
  setTimeout(() => {
    open.value = true;
  }, 80);
}
</script>

<template>
  <nav class="menu" aria-label="Account" data-uf-e688a71a="">
    <button
      type="button"
      :aria-expanded="open"
      data-uf-e688a71a=""
      @click="refresh"
    >Refresh</button>
    <p role="status" data-uf-e688a71a="">Refreshes: {{ refreshes }}</p>
    <Transition name="fade">
      <ul v-if="open" class="items" data-uf-e688a71a="">
        <li data-uf-e688a71a="">Profile</li>
      </ul>
    </Transition>
  </nav>
</template>

<style src="./Menu.uf.tsx.css"></style>
