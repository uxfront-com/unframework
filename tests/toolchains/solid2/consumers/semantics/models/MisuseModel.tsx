import { createSignal } from "solid-js";

import Disclosure from "../../../../../integration/cases/semantics/models/__output__/solid2/Disclosure";

export function MisuseModel() {
  const [open, set] = createSignal("yes");
  // @uf-expect TS2322 Disclosure.model:open
  return <Disclosure open={open()} onOpenChange={set} title="Shipping" />;
}
