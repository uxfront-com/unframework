import { component$ } from "@qwik.dev/core";

import Status from "../../../../../integration/cases/types/package-types/__output__/qwik/Status";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Status.prop:interval
  return <Status label="Feed" value="tick" interval="fast" />;
});
