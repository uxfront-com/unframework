import { useState } from "react";

import Select from "../../../../../integration/cases/generics/select/__output__/react/Select";

export function MisuseModel() {
  const [count, setCount] = useState(1);
  // @uf-expect TS2322 Select.model:value
  return <Select value={count} onValueChange={setCount} label="Size" options={["s", "m"]} />;
}
