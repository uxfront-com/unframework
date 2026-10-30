import { component$ } from "@qwik.dev/core";

import Status from "../../../../../integration/cases/types/package-types/__output__/qwik/Status";

export const Consumer = component$(() => {
  return <Status label="Feed" value="tick" interval={250} />;
});
