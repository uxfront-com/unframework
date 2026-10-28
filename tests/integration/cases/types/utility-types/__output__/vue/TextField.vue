<script setup lang="ts">
import type { FieldOptions } from "./types";

export type TextFieldProps = Required<Pick<FieldOptions, "name" | "label">> &
  Readonly<Partial<Omit<FieldOptions, "name" | "label">>>;

const {
  name,
  label,
  placeholder = undefined,
  required = undefined,
} = defineProps<TextFieldProps>();
</script>

<template>
  <label>{{ label }}<input :name="name" :placeholder="placeholder" :required="required" /></label>
</template>
