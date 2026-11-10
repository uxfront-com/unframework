import { component$ } from "@qwik.dev/core";

import Picker from "../../../../../integration/cases/generics/scoped-slot/__output__/qwik/Picker";

export const Consumer = component$(() => {
  const fruits = [{ name: "Apple", count: 3 }];
  return (
    <Picker
      items={fruits}
      item$={({ item }) => (
        <span>
          {item.name} × {item.count}
        </span>
      )}
    />
  );
});
