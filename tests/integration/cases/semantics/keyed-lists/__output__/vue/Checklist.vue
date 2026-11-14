<script setup lang="ts">
export interface Entry {
  id: string;
  label: string;
}

export interface ChecklistProps {
  entries: Entry[];
}

const { entries } = defineProps<ChecklistProps>();
</script>

<template>
  <ul class="checklist">
    <li v-for="entry in entries" :key="entry.id">
      <label>{{ entry.label }}<input
        :name="`note-${entry.id}`"
        :aria-label="`Note for ${entry.label}`"
      /></label>
    </li>
  </ul>
</template>
