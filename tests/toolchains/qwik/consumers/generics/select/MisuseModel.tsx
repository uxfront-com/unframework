import { component$ } from "@qwik.dev/core";

import Select from "../../../../../integration/cases/generics/select/__output__/qwik/Select";

export const MisuseModel = component$(() => {
  // @uf-expect TS2322 Select.model:value
  return <Select label="Size" options={["s", "m"]} value={1} />;
});
