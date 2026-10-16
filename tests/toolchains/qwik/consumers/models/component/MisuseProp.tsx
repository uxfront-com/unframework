import { component$ } from "@qwik.dev/core";

import Stepper from "../../../../../integration/cases/models/component/__output__/qwik/Stepper";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Stepper.prop:label
  return <Stepper label={2} />;
});
