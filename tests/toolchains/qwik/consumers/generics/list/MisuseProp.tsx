import { component$ } from "@qwik.dev/core";

import List from "../../../../../integration/cases/generics/list/__output__/qwik/List";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 List.prop:selected
  return <List label="Numbers" items={[1, 2]} selected="two" />;
});
