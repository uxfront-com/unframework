import Field, { type FieldProps } from "../../../../../integration/cases/types/child-type-import/__output__/ember/Field.gts";

// @uf-expect TS2322 Field.type:FieldProps
const field: FieldProps = { name: 1, label: "Email" };

<template>
  <Field @name="email" @label={{field.label}} />
</template>
