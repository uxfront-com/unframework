import { component$ } from "@qwik.dev/core";

import Button from "../../../../../integration/cases/types/extends-chain/__output__/qwik/Button";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Button.prop:label
  return <Button id="save" label={1} />;
});
