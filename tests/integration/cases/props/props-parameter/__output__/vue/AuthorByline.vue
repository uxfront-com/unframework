<script setup lang="ts">
export interface AuthorBylineProps {
  author: string;
  published: string;
  minutes: number;
  affiliation?: string;
}

const props = withDefaults(defineProps<AuthorBylineProps>(), { affiliation: undefined });
</script>

<template>
  <p
    class="byline"
  >By {{ props.author }}, {{ props.affiliation ?? "independent" }}<br /><time
    :datetime="props.published"
  >{{ props.published }}</time> · {{ props.minutes }} min read</p>
</template>
