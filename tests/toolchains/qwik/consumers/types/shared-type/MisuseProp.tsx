import { component$ } from "@qwik.dev/core";

import Palette from "../../../../../integration/cases/types/shared-type/__output__/qwik/Palette";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Palette.prop:tone
  return <Palette tone="loud" />;
});
