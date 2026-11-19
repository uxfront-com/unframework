<script lang="ts">
export interface TagProps {
  label: string;
  tone?: string;
}
</script>

<script setup vapor lang="ts">
const { label, tone: _tone = undefined } = defineProps<TagProps>();
</script>

<template>
  <em class="tag" style="color: rgb(120, 30, 30); padding: 1px 4px">{{ label }}</em>
</template>
