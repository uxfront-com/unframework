import List from "../../../../../integration/cases/slots/scoped/__output__/solid/List";

export function Consumer() {
  return (
    <List
      items={["a", "b"]}
      label="Letters"
      item={({ item, index }) => `${index}: ${item.toUpperCase()}`}
    />
  );
}
