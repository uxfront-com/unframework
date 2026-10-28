<script setup lang="ts">
import type { FieldProps } from "../../../../../integration/cases/types/child-type-import/__output__/vue/Field.vue";
import Form from "../../../../../integration/cases/types/child-type-import/__output__/vue/Form.vue";

const field: FieldProps = { name: "email", label: "Email" };
</script>

<template>
  <Form :field="field" />
</template>
