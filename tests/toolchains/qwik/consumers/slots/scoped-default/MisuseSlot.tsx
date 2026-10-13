import { component$ } from "@qwik.dev/core";

import Names from "../../../../../integration/cases/slots/scoped-default/__output__/qwik/Names";

export const MisuseSlot = component$(() => {
  // @uf-expect TS2339 Names.slot:default
  return <Names names={["Ada"]} default$={({ name }) => <b>{name}</b>} />;
});
