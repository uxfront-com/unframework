import Picker from "../../../../../integration/cases/generics/scoped-slot/__output__/solid/Picker";

const fruits = [{ name: "Apple", count: 3 }];

export function MisuseSlot() {
  return (
    <Picker
      items={fruits}
      // @uf-expect TS2339 Picker.slot:item
      item={({ item }) => item.weight}
    />
  );
}
