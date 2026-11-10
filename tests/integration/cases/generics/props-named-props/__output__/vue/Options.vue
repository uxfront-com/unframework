<script setup lang="ts" generic="T">
interface Props<T> {
  heading: string;
  options: T[];
  selected?: T;
}

const { heading, options, selected = undefined } = defineProps<Props<T>>();
</script>

<template>
  <h2>{{ heading }}</h2>
  <ul :aria-label="heading">
    <li
      v-for="(option, index) in options"
      :key="index"
      :aria-current="option === selected ? 'true' : undefined"
    >{{ String(option) }}</li>
  </ul>
</template>
