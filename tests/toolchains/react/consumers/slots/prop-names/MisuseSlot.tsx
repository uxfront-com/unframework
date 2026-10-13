import Table from "../../../../../integration/cases/slots/prop-names/__output__/react/Table";

export function MisuseSlot() {
  // @uf-expect TS2339 Table.slot:row
  return <Table people={[{ id: "a", name: "Ada" }]} renderRow={({ size }) => size} />;
}
