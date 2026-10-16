import { component$ } from "@qwik.dev/core";

import Notice from "../../../../../integration/cases/slots/fallback/__output__/qwik/Notice";

export const MisuseSlot = component$(() => {
  // @uf-expect TS2322 Notice.slot:action
  return <Notice label="Build" action$={(href: string) => <a href={href}>Logs</a>} />;
});
