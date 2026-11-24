<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from "vue";

const { label } = defineProps<{ label: string }>();

const input = useTemplateRef<HTMLInputElement>("input");
const mounted = ref(false);

onMounted(() => {
  mounted.value = input.value !== null;
});

function fill() {
  if (input.value && !input.value.value && mounted.value) input.value.value = "Ada";
}
</script>

<template>
  <input ref="input" name="name" :aria-label="label" @focus="fill" />
</template>
