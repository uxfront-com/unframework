import TextField, {
  type TextFieldProps,
} from "../../../../../integration/cases/types/utility-types/__output__/react/TextField";

export function MisuseType() {
  // @uf-expect TS2322 TextField.type:TextFieldProps
  const field: TextFieldProps = { name: "email", label: 1 };
  return <TextField name={field.name} label="Email" />;
}
