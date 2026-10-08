<script setup lang="ts">
export interface FileInfo {
  path: string;
  size: number;
}

export interface FileRowProps {
  path: string;
  size: number;
}

const { path, size } = defineProps<FileRowProps>();
const emit = defineEmits<{
  refresh: [];
  open: [path: string];
  move: [from: string, to: string];
  pick: [file: FileInfo];
  share: [path: string, note?: string];
}>();

function archive() {
  emit("move", path, `archive/${path}`);
  emit("refresh");
}
</script>

<template>
  <div class="file-row" role="group" :aria-label="path">
    <span>{{ path }} ({{ size }} bytes)</span>
    <button type="button" @click="emit('refresh')">Refresh</button>
    <button type="button" @click="emit('open', path)">Open</button>
    <button type="button" @click="archive">Archive</button>
    <button type="button" @click="emit('pick', { path, size })">Select</button>
    <button type="button" @click="emit('share', path)">Share</button>
    <button type="button" @click="emit('share', path, 'Please review')">Share with a note</button>
  </div>
</template>
