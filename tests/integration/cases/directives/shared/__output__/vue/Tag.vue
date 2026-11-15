<script setup lang="ts">
import { vMark } from "./vMark";

export interface TagProps {
  name: string;
}

const { name } = defineProps<TagProps>();
</script>

<template>
  <em v-mark="`tag ${name}`" class="tag">#{{ name }}</em>
</template>
