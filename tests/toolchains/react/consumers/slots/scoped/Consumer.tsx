import List from "../../../../../integration/cases/slots/scoped/__output__/react/List";

export function Consumer() {
  return (
    <List
      items={["a", "b"]}
      label="Letters"
      renderItem={({ item, index }) => `${index}: ${item.toUpperCase()}`}
    />
  );
}
