import { useState } from "react";

import PriceRange from "../../../../../integration/cases/models/several/__output__/react/PriceRange";

export function Consumer() {
  const [low, setLow] = useState(0);
  const [high, setHigh] = useState(10);
  return (
    <PriceRange min={low} onMinChange={setLow} max={high} onMaxChange={setHigh} label="Price" />
  );
}
