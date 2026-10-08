<script setup lang="ts">
import List from "./List.vue";

const { names } = defineProps<{ names: string[] }>();
</script>

<template>
  <div>
    <List :items="names" label="Podium">
      <template #item="{ item, index }">
        <span>{{ index + 1 }}. <b>{{ item }}</b></span>
      </template>
    </List>
    <List :items="names" label="Initials">
      <template #item="entry">
        <i>{{ entry.item.slice(0, 1) }}</i>
      </template>
    </List>
  </div>
</template>
