import { component$ } from "@qwik.dev/core";

import Notice from "../../../../../integration/cases/slots/fallback/__output__/qwik/Notice";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Notice.prop:label
  return <Notice label={null} />;
});
