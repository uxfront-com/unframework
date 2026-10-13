import { component$ } from "@qwik.dev/core";

import Card from "../../../../../integration/cases/slots/named/__output__/qwik/Card";

export const Consumer = component$(() => {
  return (
    <Card header$={() => <h2>Notes</h2>} footer$={() => <small>By Ada</small>}>
      <p>Body</p>
    </Card>
  );
});
