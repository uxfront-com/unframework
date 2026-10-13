import { component$, useSignal } from "@qwik.dev/core";

import Stepper from "../../../../../integration/cases/models/component/__output__/qwik/Stepper";

export const Consumer = component$(() => {
  const cups = useSignal(2);
  return (
    <Stepper label="Cups" value={cups.value} onValueChange$={(value) => (cups.value = value)} />
  );
});
