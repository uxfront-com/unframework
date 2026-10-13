import { component$ } from "@qwik.dev/core";

import Table from "../../../../../integration/cases/slots/prop-names/__output__/qwik/Table";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Table.prop:people
  return <Table people={["Ada"]} />;
});
