import { component$, useSignal } from "@qwik.dev/core";

import Disclosure from "../../../../../integration/cases/semantics/models/__output__/qwik/Disclosure";

export const Consumer = component$(() => {
  const open = useSignal(true);
  return (
    <Disclosure title="Shipping" open={open.value} onOpenChange$={(next) => (open.value = next)} />
  );
});
