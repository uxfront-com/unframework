<script setup lang="ts">
import Hint from "./Hint.vue";

const { tip } = defineProps<{ tip: string }>();
</script>

<template>
  <div class="banner" data-uf-e25060c2="">
    <Hint :text="tip" data-uf-e25060c2="" />
  </div>
</template>

<style src="./Banner.uf.tsx.css"></style>
