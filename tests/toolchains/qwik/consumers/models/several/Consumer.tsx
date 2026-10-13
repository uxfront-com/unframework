import { component$, useSignal } from "@qwik.dev/core";

import PriceRange from "../../../../../integration/cases/models/several/__output__/qwik/PriceRange";

export const Consumer = component$(() => {
  const low = useSignal(20);
  return (
    <PriceRange label="Price" min={low.value} onMinChange$={(min) => (low.value = min)} max={50} />
  );
});
