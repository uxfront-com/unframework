import { component$ } from "@qwik.dev/core";

import Table from "../../../../../integration/cases/slots/prop-names/__output__/qwik/Table";

export const Consumer = component$(() => {
  return (
    <Table
      people={[{ id: "a", name: "Ada" }]}
      row$={({ name, "data-id": id, index }) => <span>{`${index} ${name} ${id}`}</span>}
    />
  );
});
