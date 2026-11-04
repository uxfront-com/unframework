import TextField, {
  type TextFieldProps,
} from "../../../../../integration/cases/types/utility-types/__output__/solid/TextField";

const field: TextFieldProps = { name: "email", label: "Email" };

export function Consumer() {
  return <TextField name={field.name} label={field.label} placeholder="you@example.com" required />;
}
