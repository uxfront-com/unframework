import type { FieldProps } from "../../../../../integration/cases/types/child-type-import/__output__/react/Field";
import Form from "../../../../../integration/cases/types/child-type-import/__output__/react/Form";

export function Consumer() {
  const field: FieldProps = { name: "email", label: "Email" };
  return <Form field={field} />;
}
