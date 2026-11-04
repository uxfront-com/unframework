<script setup lang="ts">
import Field, {
  type FieldProps,
} from "../../../../../integration/cases/types/child-type-import/__output__/vue/Field.vue";

// @uf-expect TS2322 Field.type:FieldProps
const field: FieldProps = { name: 1, label: "Email" };
</script>

<template>
  <Field name="email" :label="field.label" />
</template>
