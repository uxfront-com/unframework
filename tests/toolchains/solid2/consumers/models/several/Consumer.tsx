import { createSignal } from "solid-js";

import PriceRange from "../../../../../integration/cases/models/several/__output__/solid2/PriceRange";

export function Consumer() {
  const [max, set] = createSignal(10);
  return <PriceRange max={max()} onMaxChange={set} label="Price" />;
}
