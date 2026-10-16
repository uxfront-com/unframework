import { component$ } from "@qwik.dev/core";

import Disclosure from "../../../../../integration/cases/semantics/models/__output__/qwik/Disclosure";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Disclosure.prop:title
  return <Disclosure title={["Shipping"]} />;
});
