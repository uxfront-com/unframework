import { useState } from "react";

import Select from "../../../../../integration/cases/generics/select/__output__/react/Select";

export function Consumer() {
  const [size, setSize] = useState<"s" | "m">("s");
  return <Select value={size} onValueChange={setSize} label="Size" options={["s", "m"]} />;
}
