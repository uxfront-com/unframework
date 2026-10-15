import List from "../../../../../integration/cases/slots/scoped/__output__/solid/List";

export function MisuseProp() {
  // @uf-expect TS2322 List.prop:label
  return <List items={["a"]} label={1} />;
}
