import TextField, {
  type TextFieldProps,
} from "../../../../../integration/cases/types/utility-types/__output__/solid/TextField";

// @uf-expect TS2322 TextField.type:TextFieldProps
const field: TextFieldProps = { name: "email", label: 1 };

export function MisuseType() {
  return <TextField name={field.name} label="Email" />;
}
