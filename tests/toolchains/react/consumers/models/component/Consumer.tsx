import { useState } from "react";

import Stepper from "../../../../../integration/cases/models/component/__output__/react/Stepper";

export function Consumer() {
  const [cups, setCups] = useState(2);
  return <Stepper value={cups} onValueChange={setCups} label="Cups" />;
}
