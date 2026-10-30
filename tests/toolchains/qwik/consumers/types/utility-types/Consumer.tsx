import { component$ } from "@qwik.dev/core";

import TextField, {
  type TextFieldProps,
} from "../../../../../integration/cases/types/utility-types/__output__/qwik/TextField";

export const Consumer = component$(() => {
  const field: TextFieldProps = { name: "email", label: "Email" };
  return <TextField name={field.name} label={field.label} placeholder="you@example.com" required />;
});
