import { createSignal } from "solid-js";

import Stepper from "../../../../../integration/cases/models/component/__output__/solid/Stepper";

export function MisuseModel() {
  const [value, set] = createSignal("two");
  // @uf-expect TS2322 Stepper.model:value
  return <Stepper value={value()} onValueChange={set} label="Cups" />;
}
