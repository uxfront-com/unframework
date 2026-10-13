import { component$ } from "@qwik.dev/core";

import Panel from "../../../../../integration/cases/slots/default/__output__/qwik/Panel";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Panel.prop:title
  return <Panel title={1}>Content</Panel>;
});
