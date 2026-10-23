<script setup lang="ts">
import { ref } from "vue";

type TagStates = { selected?: boolean; muted?: boolean };

export interface TagListProps {
  label: string;
  tags: string[];
  states: TagStates;
  extra?: string[];
}

const { label, tags, states, extra = undefined } = defineProps<TagListProps>();

const expanded = ref(false);

function expand() {
  expanded.value = !expanded.value;
}
</script>

<template>
  <div class="tag-list">
    <span class="tag" :class="[tags, states, { 'tag-open': expanded }]">{{ label }}</span>
    <span :class="tags">Plain</span>
    <span :class="[extra, expanded ? ['tag-wide', 'tag-tall'] : []]">Extra</span>
    <button type="button" @click="expand">Expand</button>
  </div>
</template>
