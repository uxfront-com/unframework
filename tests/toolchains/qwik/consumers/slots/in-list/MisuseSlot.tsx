import { component$ } from "@qwik.dev/core";

import Steps from "../../../../../integration/cases/slots/in-list/__output__/qwik/Steps";

export const MisuseSlot = component$(() => {
  // @uf-expect TS2322 Steps.slot:marker
  return <Steps steps={["Boil"]} marker$={(step: string) => <span>{step}</span>} />;
});
