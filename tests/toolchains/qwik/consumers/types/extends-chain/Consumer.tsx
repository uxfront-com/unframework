import { component$ } from "@qwik.dev/core";

import Button from "../../../../../integration/cases/types/extends-chain/__output__/qwik/Button";

export const Consumer = component$(() => {
  return <Button id="save" label="Save" disabled={true} />;
});
