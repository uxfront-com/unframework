<script setup lang="ts">
import Frame from "./Frame.vue";
import Mat from "./Mat.vue";

const { matted = true } = defineProps<{ matted?: boolean }>();
</script>

<template>
  <section>
    <Frame>
      <p class="caption" data-uf-9dc516fd-s="">A quiet harbour</p>
    </Frame>
    <Frame>
      <template #label="{ text }">
        <p class="caption" data-uf-9dc516fd-s="">{{ text }}</p>
      </template>
    </Frame>
    <component :is="matted ? Mat : Frame">
      <p class="caption" data-uf-09929c4a-s="" data-uf-9dc516fd-s="">A matted print</p>
    </component>
    <p class="caption">Outside the frame</p>
  </section>
</template>
