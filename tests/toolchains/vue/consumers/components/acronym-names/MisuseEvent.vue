<script setup lang="ts">
import Avatar from "../../../../../integration/cases/components/acronym-names/__output__/vue/Avatar.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Avatar.event:pickedURL -->
  <Avatar image-u-r-l="/b.png" :user-i-d="3" @picked-u-r-l="(count: number) => count + 1" />
</template>
