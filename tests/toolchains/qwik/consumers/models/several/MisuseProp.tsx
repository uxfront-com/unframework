import { component$ } from "@qwik.dev/core";

import PriceRange from "../../../../../integration/cases/models/several/__output__/qwik/PriceRange";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 PriceRange.prop:label
  return <PriceRange label={false} />;
});
