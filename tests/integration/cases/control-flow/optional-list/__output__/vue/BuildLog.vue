<script setup lang="ts">
interface LogLine {
  id: string;
  text: string;
}

export interface BuildLogProps {
  target: string;
  failed: boolean;
  lines?: LogLine[] | null;
  warnings?: string[];
}

const { target, failed, lines = undefined, warnings = undefined } = defineProps<BuildLogProps>();
</script>

<template>
  <section class="build-log" aria-label="Build log">
    <pre>$ make {{ target }}<strong v-if="failed"> (failed)</strong>
<code v-for="line in lines ?? []" :key="line.id">{{ line.text }}{{ "\n" }}</code></pre>
    <ul aria-label="Warnings">
      <li v-for="warning in warnings ?? []" :key="warning">{{ warning }}</li>
    </ul>
  </section>
</template>
