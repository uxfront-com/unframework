import { createSignal } from "solid-js";

import Disclosure from "../../../../../integration/cases/semantics/models/__output__/solid/Disclosure";

export function Consumer() {
  const [open, set] = createSignal(false);
  return <Disclosure open={open()} onOpenChange={set} title="Shipping" />;
}
