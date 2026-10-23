<script setup lang="ts">
defineSlots<{ default?(): unknown; label?(props: { text: string }): unknown }>();
</script>

<template>
  <figure class="frame" data-uf-9dc516fd="">
    <slot />
    <slot name="label" :text="'Harbour at dusk'" />
  </figure>
</template>

<style src="./Frame.uf.tsx.css"></style>
