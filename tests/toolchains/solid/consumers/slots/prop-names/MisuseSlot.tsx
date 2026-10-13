import Table from "../../../../../integration/cases/slots/prop-names/__output__/solid/Table";

export function MisuseSlot() {
  return (
    <Table
      people={[{ id: "a", name: "Ada" }]}
      // @uf-expect TS2339 Table.slot:row
      row={({ size }) => size}
    />
  );
}
