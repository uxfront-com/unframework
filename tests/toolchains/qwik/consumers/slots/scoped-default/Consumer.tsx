import { component$ } from "@qwik.dev/core";

import Names from "../../../../../integration/cases/slots/scoped-default/__output__/qwik/Names";

export const Consumer = component$(() => {
  return <Names names={["Ada"]} default$={({ item }) => <b>{item}!</b>} />;
});
