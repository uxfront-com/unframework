<script setup lang="ts">
export type Source =
  | { kind: "link"; id: string; title: string; href: string }
  | { kind: "book"; id: string; title: string; note?: string };

export interface ReadingProps {
  sources: Source[];
}

const { sources } = defineProps<ReadingProps>();
const emit = defineEmits<{ open: [href: string] }>();
</script>

<template>
  <ul class="reading" aria-label="Reading list">
    <li
      v-for="(source, index) in sources"
      :key="source.id"
      :title="source.kind === 'link' ? source.href : source.title"
    >{{ index + 1 }}. {{ source.title }}{{ source.kind === "book" && source.note ? ` (${source.note.trim()})` : "" }}<button
      v-if="source.kind === 'link'"
      type="button"
      @click="emit('open', source.href)"
    >{{ `Open ${source.title}` }}</button></li>
  </ul>
</template>
