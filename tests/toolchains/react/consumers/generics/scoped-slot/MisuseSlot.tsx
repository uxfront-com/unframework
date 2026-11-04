import Picker from "../../../../../integration/cases/generics/scoped-slot/__output__/react/Picker";

export function MisuseSlot() {
  const fruits = [{ name: "Apple", count: 3 }];
  // @uf-expect TS2339 Picker.slot:item
  return <Picker items={fruits} renderItem={({ item }) => item.nmae} />;
}
