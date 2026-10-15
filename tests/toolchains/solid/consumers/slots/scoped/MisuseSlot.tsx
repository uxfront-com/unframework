import List from "../../../../../integration/cases/slots/scoped/__output__/solid/List";

export function MisuseSlot() {
  return (
    <List
      items={["a", "b"]}
      label="Letters"
      // @uf-expect TS2339 List.slot:item
      item={({ size }) => size}
    />
  );
}
