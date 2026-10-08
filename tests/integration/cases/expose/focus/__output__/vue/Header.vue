<script setup lang="ts">
import SearchField from "./SearchField.vue";
import { useTemplateRef } from "vue";

const search = useTemplateRef<{ focus(): void }>("search");
</script>

<template>
  <header class="header">
    <SearchField ref="search" label="Find" />
    <button type="button" @click="search?.focus()">Search</button>
  </header>
</template>
