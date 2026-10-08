<script setup lang="ts">
import Tag from "../../../../../integration/cases/fallthrough/class-and-style/__output__/vue/Tag.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Tag.prop:label -->
  <Tag :label="[]" />
</template>
