import { component$ } from "@qwik.dev/core";

import Names from "../../../../../integration/cases/slots/scoped-default/__output__/qwik/Names";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Names.prop:names
  return <Names names={[1]} />;
});
