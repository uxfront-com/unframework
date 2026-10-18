import { component$ } from "@qwik.dev/core";

import Notice from "../../../../../integration/cases/slots/fallback/__output__/qwik/Notice";

export const Consumer = component$(() => {
  return (
    <Notice label="Build" action$={() => <a href="#logs">Logs</a>}>
      Failed.
    </Notice>
  );
});
