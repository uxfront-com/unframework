<script setup lang="ts">
import TextField, {
  type TextFieldProps,
} from "../../../../../integration/cases/types/utility-types/__output__/vue/TextField.vue";

// @uf-expect TS2322 TextField.type:TextFieldProps
const field: TextFieldProps = { name: "email", label: 1 };
</script>

<template>
  <TextField :name="field.name" label="Email" />
</template>
