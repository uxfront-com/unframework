import { component$ } from "@qwik.dev/core";

import Card from "../../../../../integration/cases/slots/named/__output__/qwik/Card";

export const MisuseSlot = component$(() => {
  // @uf-expect TS2322 Card.slot:header
  return <Card header$={(title: string) => <h2>{title}</h2>} />;
});
