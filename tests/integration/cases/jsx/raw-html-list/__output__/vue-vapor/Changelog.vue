<script lang="ts">
export interface Entry {
  id: number;
  html: string;
}

export interface ChangelogProps {
  entries: Entry[];
}
</script>

<script setup vapor lang="ts">
const { entries } = defineProps<ChangelogProps>();
</script>

<template>
  <ul class="changelog">
    <li v-for="entry in entries" :key="entry.id" v-html="entry.html"></li>
  </ul>
</template>
