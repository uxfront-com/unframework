import { createSignal } from "solid-js";

import PriceRange from "../../../../../integration/cases/models/several/__output__/solid/PriceRange";

export function MisuseModel() {
  const [max, set] = createSignal("ten");
  // @uf-expect TS2322 PriceRange.model:max
  return <PriceRange max={max()} onMaxChange={set} label="Price" />;
}
