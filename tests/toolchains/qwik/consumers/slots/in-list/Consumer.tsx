import { component$ } from "@qwik.dev/core";

import Steps from "../../../../../integration/cases/slots/in-list/__output__/qwik/Steps";

export const Consumer = component$(() => {
  return <Steps steps={["Boil", "Steep"]} marker$={() => <span>&gt; </span>} />;
});
