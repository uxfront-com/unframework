import { useState } from "react";

import Disclosure from "../../../../../integration/cases/semantics/models/__output__/react/Disclosure";

export function Consumer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Disclosure open={open} onOpenChange={setOpen} title="Shipping" />
      <Disclosure title="Returns" />
    </>
  );
}
