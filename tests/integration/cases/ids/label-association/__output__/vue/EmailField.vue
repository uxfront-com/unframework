<script setup lang="ts">
import { useId } from "vue";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

const { label, hint } = defineProps<EmailFieldProps>();

const inputId = `uf-id-${useId()}`;
const hintId = `uf-id-${useId()}`;
</script>

<template>
  <div class="email-field">
    <label :for="inputId">{{ label }}</label>
    <input :id="inputId" name="email" type="email" :aria-describedby="hintId" />
    <p :id="hintId">{{ hint }}</p>
  </div>
</template>
