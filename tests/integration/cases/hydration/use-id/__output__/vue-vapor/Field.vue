<script lang="ts">
export interface FieldProps {
  label: string;
  hint: string;
}
</script>

<script setup vapor lang="ts">
import { useId } from "vue";

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
