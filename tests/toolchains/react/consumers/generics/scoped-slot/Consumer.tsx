import Picker from "../../../../../integration/cases/generics/scoped-slot/__output__/react/Picker";

export function Consumer() {
  const fruits = [{ name: "Apple", count: 3 }];
  return <Picker items={fruits} renderItem={({ item }) => `${item.name} × ${item.count}`} />;
}
