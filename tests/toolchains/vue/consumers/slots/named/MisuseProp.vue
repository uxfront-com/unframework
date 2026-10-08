<script setup lang="ts">
import Post from "../../../../../integration/cases/slots/named/__output__/vue/Post.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Post.prop:author -->
  <Post :author="42" />
</template>
