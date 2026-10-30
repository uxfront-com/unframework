import { component$ } from "@qwik.dev/core";

import List from "../../../../../integration/cases/generics/list/__output__/qwik/List";

export const Consumer = component$(() => {
  return <List label="Numbers" items={[1, 2]} selected={2} />;
});
