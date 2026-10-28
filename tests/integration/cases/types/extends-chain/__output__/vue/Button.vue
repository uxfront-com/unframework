<script setup lang="ts">
import type { ButtonProps } from "./types";

const { disabled = false, label, id } = defineProps<ButtonProps>();
</script>

<template>
  <button :id="id" type="button" :disabled="disabled">{{ label }}</button>
</template>
