import { component$ } from "@qwik.dev/core";

import Form from "../../../../../integration/cases/types/child-type-import/__output__/qwik/Form";

export const MisuseProp = component$(() => {
  // @uf-expect TS2741 Form.prop:field
  return <Form field={{ name: "email" }} />;
});
