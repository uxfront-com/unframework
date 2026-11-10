import { component$ } from "@qwik.dev/core";

import Picker from "../../../../../integration/cases/generics/scoped-slot/__output__/qwik/Picker";

export const MisuseSlot = component$(() => {
  const fruits = [{ name: "Apple", count: 3 }];
  // @uf-expect TS2339 Picker.slot:item
  return <Picker items={fruits} item$={({ item }) => <span>{item.nmae}</span>} />;
});
