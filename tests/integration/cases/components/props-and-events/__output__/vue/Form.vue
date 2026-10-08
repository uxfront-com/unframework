<script setup lang="ts">
import Field from "./Field.vue";
import { ref } from "vue";

const { city } = defineProps<{ city: string }>();

const cleared = ref("nothing");

function clear(label: string) {
  cleared.value = label;
}
</script>

<template>
  <section aria-label="Address">
    <Field label="Street" @clear="clear" />
    <Field :label="city" tone="warn" @clear="(label) => clear(label.toUpperCase())" />
    <output>Cleared: {{ cleared }}</output>
  </section>
</template>
