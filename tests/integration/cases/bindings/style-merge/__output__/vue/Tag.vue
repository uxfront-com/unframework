<script setup lang="ts">
export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

const {
  label,
  colour = undefined,
  weight = undefined,
  indent = undefined,
} = defineProps<TagProps>();
</script>

<template>
  <span
    class="tag"
    style="display: inline-block; padding: 2px 8px; border-style: solid; border-width: 1px"
    :style="{ 'border-color': colour ?? '#5a5a5a', color: colour, 'font-weight': weight, 'margin-left': indent }"
  >{{ label }}</span>
</template>
