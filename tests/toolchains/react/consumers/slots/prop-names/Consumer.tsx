import Table from "../../../../../integration/cases/slots/prop-names/__output__/react/Table";

export function Consumer() {
  return (
    <Table
      people={[{ id: "a", name: "Ada" }]}
      renderRow={({ name, index }) => `${index}: ${name.toUpperCase()}`}
    />
  );
}
