import { component$ } from "@qwik.dev/core";

import Panel from "../../../../../integration/cases/slots/default/__output__/qwik/Panel";

export const Consumer = component$(() => {
  return (
    <Panel title="Hello">
      <p>Content</p>
    </Panel>
  );
});
