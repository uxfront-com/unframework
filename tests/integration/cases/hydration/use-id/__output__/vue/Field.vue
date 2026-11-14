<script setup lang="ts">
import { useId } from "vue";

export interface FieldProps {
  label: string;
  hint: string;
}

const { label, hint } = defineProps<FieldProps>();

const inputId = `uf-id-${useId()}`;
const hintId = `uf-id-${useId()}`;
</script>

<template>
  <p class="field">
    <label :for="inputId">{{ label }}</label>
    <input :id="inputId" type="text" :aria-describedby="hintId" />
    <small :id="hintId">{{ hint }}</small>
  </p>
</template>
