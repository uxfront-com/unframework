import Field, {
  type FieldProps,
} from "../../../../../integration/cases/types/child-type-import/__output__/react/Field";

export function MisuseType() {
  // @uf-expect TS2322 Field.type:FieldProps
  const field: FieldProps = { name: 1, label: "Email" };
  return <Field name="email" label={field.label} />;
}
