import { component$ } from "@qwik.dev/core";

import type { FieldProps } from "../../../../../integration/cases/types/child-type-import/__output__/qwik/Field";
import Form from "../../../../../integration/cases/types/child-type-import/__output__/qwik/Form";

export const Consumer = component$(() => {
  const field: FieldProps = { name: "email", label: "Email" };
  return <Form field={field} />;
});
