import Table from "../../../../../integration/cases/slots/prop-names/__output__/solid/Table";

export function MisuseProp() {
  // @uf-expect TS2322 Table.prop:people
  return <Table people="Ada" />;
}
