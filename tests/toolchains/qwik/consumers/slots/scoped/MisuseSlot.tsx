import { component$ } from "@qwik.dev/core";

import List from "../../../../../integration/cases/slots/scoped/__output__/qwik/List";

export const MisuseSlot = component$(() => {
  // @uf-expect TS2339 List.slot:item
  return <List items={["a"]} label="Letters" item$={({ size }) => <i>{size}</i>} />;
});
