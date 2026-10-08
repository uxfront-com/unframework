<script setup lang="ts">
import Avatar from "../../../../../integration/cases/components/acronym-names/__output__/vue/Avatar.vue";
</script>

<template>
  <Avatar image-u-r-l="/b.png" :user-i-d="3" @picked-u-r-l="(url: string) => url.length" />
</template>
