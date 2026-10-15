import { createSignal } from "solid-js";

import Disclosure from "../../../../../integration/cases/semantics/models/__output__/solid/Disclosure";

export function MisuseModel() {
  const [open, set] = createSignal("yes");
  // @uf-expect TS2322 Disclosure.model:open
  return <Disclosure open={open()} onOpenChange={set} title="Shipping" />;
}
