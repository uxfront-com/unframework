import { component$ } from "@qwik.dev/core";

import Badge from "../../../../../integration/cases/types/imported-interface/__output__/qwik/Badge";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Badge.prop:tone
  return <Badge label="New" tone="warning" />;
});
