import { useState } from "react";

import Disclosure from "../../../../../integration/cases/semantics/models/__output__/react/Disclosure";

export function MisuseModel() {
  const [open, setOpen] = useState("yes");
  // @uf-expect TS2322 Disclosure.model:open
  return <Disclosure open={open} onOpenChange={setOpen} title="Shipping" />;
}
