import { component$ } from "@qwik.dev/core";

import List from "../../../../../integration/cases/slots/scoped/__output__/qwik/List";

export const Consumer = component$(() => {
  return (
    <List
      items={["a", "b"]}
      label="Letters"
      item$={({ item, index }) => <span>{`${index}: ${item.toUpperCase()}`}</span>}
    />
  );
});
