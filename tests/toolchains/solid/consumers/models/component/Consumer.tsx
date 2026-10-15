import { createSignal } from "solid-js";

import Stepper from "../../../../../integration/cases/models/component/__output__/solid/Stepper";

export function Consumer() {
  const [value, set] = createSignal(2);
  return <Stepper value={value()} onValueChange={set} label="Cups" />;
}
