import Picker from "../../../../../integration/cases/generics/scoped-slot/__output__/solid/Picker";

const fruits = [{ name: "Apple", count: 3 }];

export function Consumer() {
  return <Picker items={fruits} item={({ item }) => `${item.name} × ${item.count}`} />;
}
