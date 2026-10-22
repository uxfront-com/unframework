<script setup lang="ts">
import Amber from "./Amber.vue";
import Blue from "./Blue.vue";

const items = [
  { label: "Warm", warm: true },
  { label: "Cool", warm: false },
];
</script>

<template>
  <section>
    <Blue>
      <p class="caption" data-uf-721c504a-s="">In blue</p>
    </Blue>
    <Amber>
      <p class="caption" data-uf-c97301b3-s="">In amber</p>
    </Amber>
    <div v-for="item in items" :key="item.label">
      <component :is="item.warm ? Amber : Blue">
        <p class="caption" data-uf-c97301b3-s="" data-uf-721c504a-s="">{{ item.label }}</p>
      </component>
    </div>
  </section>
</template>
