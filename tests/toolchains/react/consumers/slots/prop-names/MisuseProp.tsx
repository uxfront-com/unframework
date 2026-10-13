import Table from "../../../../../integration/cases/slots/prop-names/__output__/react/Table";

export function MisuseProp() {
  // @uf-expect TS2322 Table.prop:people
  return <Table people="Ada" />;
}
