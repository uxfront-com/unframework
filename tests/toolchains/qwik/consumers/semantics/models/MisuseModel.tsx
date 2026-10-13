import { component$ } from "@qwik.dev/core";

import Disclosure from "../../../../../integration/cases/semantics/models/__output__/qwik/Disclosure";

export const MisuseModel = component$(() => {
  // @uf-expect TS2322 Disclosure.model:open
  return <Disclosure title="Shipping" open="yes" />;
});
