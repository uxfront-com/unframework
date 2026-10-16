import { component$ } from "@qwik.dev/core";

import Table from "../../../../../integration/cases/slots/prop-names/__output__/qwik/Table";

export const MisuseSlot = component$(() => {
  // @uf-expect TS2339 Table.slot:row
  return <Table people={[]} row$={({ email }) => <span>{email}</span>} />;
});
