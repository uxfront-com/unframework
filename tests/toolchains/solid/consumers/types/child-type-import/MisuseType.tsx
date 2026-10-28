import Field, {
  type FieldProps,
} from "../../../../../integration/cases/types/child-type-import/__output__/solid/Field";

// @uf-expect TS2322 Field.type:FieldProps
const field: FieldProps = { name: 1, label: "Email" };

export function MisuseType() {
  return <Field name="email" label={field.label} />;
}
