import type { FieldProps } from "../../../../../integration/cases/types/child-type-import/__output__/solid2/Field";
import Form from "../../../../../integration/cases/types/child-type-import/__output__/solid2/Form";

const field: FieldProps = { name: "email", label: "Email" };

export function Consumer() {
  return <Form field={field} />;
}
