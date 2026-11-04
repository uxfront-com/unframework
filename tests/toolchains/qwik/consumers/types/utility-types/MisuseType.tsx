import { component$ } from "@qwik.dev/core";

import TextField, {
  type TextFieldProps,
} from "../../../../../integration/cases/types/utility-types/__output__/qwik/TextField";

export const MisuseType = component$(() => {
  // @uf-expect TS2322 TextField.type:TextFieldProps
  const field: TextFieldProps = { name: "email", label: 1 };
  return <TextField name={field.name} label="Email" />;
});
