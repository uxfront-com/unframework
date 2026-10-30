import { component$ } from "@qwik.dev/core";

import Table from "../../../../../integration/cases/generics/constrained/__output__/qwik/Table";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Table.prop:rows
  return <Table caption="People" rows={[{ id: 1, label: "Ada Lovelace" }]} />;
});
