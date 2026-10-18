import { component$ } from "@qwik.dev/core";

import Steps from "../../../../../integration/cases/slots/in-list/__output__/qwik/Steps";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Steps.prop:steps
  return <Steps steps="Boil" />;
});
