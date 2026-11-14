<script setup lang="ts">
import { computed, ref } from "vue";

export interface GlossaryProps {
  terms: string[];
  definitions: string[];
}

const { terms, definitions } = defineProps<GlossaryProps>();

const index = ref(0);
const definition = computed(() => definitions[index.value] ?? "");

function next() {
  index.value = (index.value + 1) % terms.length;
}
</script>

<template>
  <section class="glossary" aria-label="Glossary">
    <h2>{{ terms[index] }}</h2>
    <div class="definition" v-html="definition"></div>
    <button type="button" @click="next">Next term</button>
  </section>
</template>
