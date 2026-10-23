<script setup lang="ts">
export interface ExcerptProps {
  title: string;
  text: string;
  fill: string;
  stroke: string;
}

const { title, text, fill, stroke } = defineProps<ExcerptProps>();
</script>

<template>
  <article class="excerpt">
    <h2
      style="-webkit-text-stroke-width: 1px; color: rgb(0, 0, 0)"
      :style="{ '-webkit-text-fill-color': fill, '-webkit-text-stroke-color': stroke }"
    >{{ title }}</h2>
    <p
      style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; width: 240px"
    >{{ text }}</p>
  </article>
</template>
