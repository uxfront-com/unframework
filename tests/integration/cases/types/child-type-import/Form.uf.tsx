import Field from "./Field.uf.tsx";
import type { FieldProps } from "./Field.uf.tsx";

// A props type a child's module exports, imported from the child (ADR-0067).
export default function Form({ field }: { field: FieldProps }) {
  return (
    <form aria-label="Sign up">
      <Field name={field.name} label={field.label} />
    </form>
  );
}
