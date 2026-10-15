import { useState } from "react";

import Stepper from "../../../../../integration/cases/models/component/__output__/react/Stepper";

export function MisuseModel() {
  const [cups, setCups] = useState("two");
  // @uf-expect TS2322 Stepper.model:value
  return <Stepper value={cups} onValueChange={setCups} label="Cups" />;
}
