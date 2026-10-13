import List from "../../../../../integration/cases/slots/scoped/__output__/react/List";

export function MisuseSlot() {
  // @uf-expect TS2339 List.slot:item
  return <List items={["a", "b"]} label="Letters" renderItem={({ size }) => size} />;
}
