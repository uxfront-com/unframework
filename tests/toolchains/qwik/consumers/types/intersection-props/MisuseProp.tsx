import { component$ } from "@qwik.dev/core";

import Chip from "../../../../../integration/cases/types/intersection-props/__output__/qwik/Chip";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Chip.prop:size
  return <Chip size="medium" label="Draft" />;
});
