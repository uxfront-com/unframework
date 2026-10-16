import { component$ } from "@qwik.dev/core";

import Stepper from "../../../../../integration/cases/models/component/__output__/qwik/Stepper";

export const MisuseModel = component$(() => {
  // @uf-expect TS2322 Stepper.model:value
  return <Stepper label="Cups" value="two" />;
});
