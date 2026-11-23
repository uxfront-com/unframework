import TextField, { type TextFieldProps } from "../../../../../integration/cases/types/utility-types/__output__/ember/TextField.gts";

// @uf-expect TS2322 TextField.type:TextFieldProps
const field: TextFieldProps = { name: "email", label: 1 };

<template>
  <TextField @name={{field.name}} @label="Email" />
</template>
