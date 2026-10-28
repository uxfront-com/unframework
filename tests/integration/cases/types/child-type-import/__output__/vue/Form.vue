<script setup lang="ts">
import Field, { type FieldProps } from "./Field.vue";

const { field } = defineProps<{ field: FieldProps }>();
</script>

<template>
  <form aria-label="Sign up">
    <Field :name="field.name" :label="field.label" />
  </form>
</template>
