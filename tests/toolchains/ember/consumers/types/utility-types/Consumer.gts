import TextField, { type TextFieldProps } from "../../../../../integration/cases/types/utility-types/__output__/ember/TextField.gts";

const field: TextFieldProps = { name: "email", label: "Email" };

<template>
  <TextField @name={{field.name}} @label={{field.label}} @placeholder="you@example.com" @required={{true}} />
</template>
