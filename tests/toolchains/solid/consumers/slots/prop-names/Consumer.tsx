import Table from "../../../../../integration/cases/slots/prop-names/__output__/solid/Table";

export function Consumer() {
  return (
    <Table
      people={[{ id: "a", name: "Ada" }]}
      row={({ name, index }) => `${index}: ${name.toUpperCase()}`}
    />
  );
}
