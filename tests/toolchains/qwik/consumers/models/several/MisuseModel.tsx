import { $, component$ } from "@qwik.dev/core";

import PriceRange from "../../../../../integration/cases/models/several/__output__/qwik/PriceRange";

export const MisuseModel = component$(() => {
  const changed = $((max: string) => max.trim());
  // @uf-expect TS2322 PriceRange.model:max
  return <PriceRange label="Price" onMaxChange$={changed} />;
});
