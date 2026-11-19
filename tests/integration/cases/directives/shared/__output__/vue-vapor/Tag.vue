<script lang="ts">
export interface TagProps {
  name: string;
}
</script>

<script setup vapor lang="ts">
import { vMark } from "./vMark";

const { name } = defineProps<TagProps>();
</script>

<template>
  <em v-mark="`tag ${name}`" class="tag">#{{ name }}</em>
</template>
