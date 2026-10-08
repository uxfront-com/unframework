<script setup lang="ts">
import { useTemplateRef } from "vue";

const { label } = defineProps<{ label: string }>();

const input = useTemplateRef<HTMLInputElement>("input");

function focus() {
  input.value?.focus();
}

defineExpose({ focus });
</script>

<template>
  <label class="search">{{ label }}<input ref="input" type="search" /></label>
</template>
