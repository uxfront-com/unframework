<script setup lang="ts">
import TextField, {
  type TextFieldProps,
} from "../../../../../integration/cases/types/utility-types/__output__/vue/TextField.vue";

const field: TextFieldProps = { name: "email", label: "Email" };
</script>

<template>
  <TextField :name="field.name" :label="field.label" placeholder="you@example.com" required />
</template>
