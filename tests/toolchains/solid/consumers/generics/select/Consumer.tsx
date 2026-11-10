import { createSignal } from "solid-js";

import Select from "../../../../../integration/cases/generics/select/__output__/solid/Select";

export function Consumer() {
  const [size, setSize] = createSignal<"s" | "m">("s");
  return <Select value={size()} onValueChange={setSize} label="Size" options={["s", "m"]} />;
}
