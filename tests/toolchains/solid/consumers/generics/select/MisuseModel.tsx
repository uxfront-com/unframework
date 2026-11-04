import { createSignal } from "solid-js";

import Select from "../../../../../integration/cases/generics/select/__output__/solid/Select";

export function MisuseModel() {
  const [count, setCount] = createSignal(1);
  // @uf-expect TS2322 Select.model:value
  return <Select value={count()} onValueChange={setCount} label="Size" options={["s", "m"]} />;
}
