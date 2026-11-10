import { component$ } from "@qwik.dev/core";

import Button from "../../../../../integration/cases/types/exported-types/__output__/qwik/Button";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Button.prop:tone
  return <Button label="Save" tone="danger" />;
});
