import Table from "../../../../../integration/cases/generics/constrained/__output__/solid/Table";

export function MisuseProp() {
  // @uf-expect TS2322 Table.prop:rows
  return <Table caption="People" rows={[{ id: 1, label: "Ada Lovelace" }]} />;
}
