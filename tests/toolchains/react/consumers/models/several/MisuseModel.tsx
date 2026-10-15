import { useState } from "react";

import PriceRange from "../../../../../integration/cases/models/several/__output__/react/PriceRange";

export function MisuseModel() {
  const [high, setHigh] = useState("ten");
  // @uf-expect TS2322 PriceRange.model:max
  return <PriceRange max={high} onMaxChange={setHigh} label="Price" />;
}
