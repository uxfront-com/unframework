import { component$ } from "@qwik.dev/core";

import List from "../../../../../integration/cases/slots/scoped/__output__/qwik/List";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 List.prop:label
  return <List items={["a"]} label={1} />;
});
