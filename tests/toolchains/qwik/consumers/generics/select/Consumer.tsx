import { component$, useSignal } from "@qwik.dev/core";

import Select from "../../../../../integration/cases/generics/select/__output__/qwik/Select";

export const Consumer = component$(() => {
  const size = useSignal<"s" | "m">("s");
  return (
    <Select
      label="Size"
      options={["s", "m"]}
      value={size.value}
      onValueChange$={(value) => (size.value = value)}
    />
  );
});
