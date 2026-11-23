import Field, { type FieldProps } from "../../../../../integration/cases/types/child-type-import/__output__/ember/Field.gts";

const field: FieldProps = { name: "email", label: "Email" };

<template>
  <Field @name={{field.name}} @label={{field.label}} />
</template>
