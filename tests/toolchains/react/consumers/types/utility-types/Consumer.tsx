import TextField, {
  type TextFieldProps,
} from "../../../../../integration/cases/types/utility-types/__output__/react/TextField";

export function Consumer() {
  const field: TextFieldProps = { name: "email", label: "Email" };
  return <TextField name={field.name} label={field.label} placeholder="you@example.com" required />;
}
